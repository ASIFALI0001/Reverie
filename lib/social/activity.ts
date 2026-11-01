import "server-only";
import { connectDb } from "@/lib/db/connect";
import { Activity } from "@/lib/db/models/Social";
import { LibraryItem, WatchlistItem } from "@/lib/db/models/Library";
import { User, privacyOf, type UserDoc } from "@/lib/db/models/User";
import { CARD_PROJECTION, titlesCol } from "@/lib/db/titles";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { peopleByUid, type Person } from "@/lib/social/people";
import { blockedAround, friendUids } from "@/lib/social/relations";
import { canSee } from "@/lib/social/visibility";
import type { MediaType, TitleKey } from "@/lib/catalog/types";

/**
 * The light activity strip: "Aman watched Dark · rated 10", "Priya saved Interstellar".
 * Written as people use their library; shown only to friends who may see activity (the owner's
 * "Everything" setting), never for a hidden title, and gone after 90 days (TTL index).
 */

export type ActivityType = "watched" | "rated" | "started" | "watchlisted";
type TitleRef = { key: string; mediaType: MediaType; tmdbId: number };

/** A burst of edits to the same title is one moment, not five. */
const MERGE_MS = 6 * 3_600_000;
const STRIP_DAYS = 30;

export async function recordActivity(uid: string, type: ActivityType, title: TitleRef, rating: number | null = null) {
  try {
    await connectDb();
    const now = new Date();
    const merged = await Activity.findOneAndUpdate(
      { uid, key: title.key, type, createdAt: { $gte: new Date(now.getTime() - MERGE_MS) } },
      { $set: { rating, createdAt: now } },
    );
    if (!merged) await Activity.create({ uid, type, key: title.key, mediaType: title.mediaType, tmdbId: title.tmdbId, rating, createdAt: now });
  } catch (err) {
    // The strip is a nicety: a failed write never fails the library change behind it.
    console.warn("[activity] not recorded:", err instanceof Error ? err.message : err);
  }
}

/** A title was hidden from friends or removed: its activity (of one type, or all) goes too. */
export async function forgetActivity(uid: string, key: string, type?: ActivityType) {
  await connectDb();
  await Activity.deleteMany({ uid, key, ...(type ? { type } : {}) });
}

export type ActivityItem = { id: string; person: Person; type: ActivityType; card: TitleCard; rating: number | null; at: string };

export async function friendsActivity(viewer: string, limit = 10): Promise<ActivityItem[]> {
  await connectDb();
  const [friends, blocked] = await Promise.all([friendUids(viewer), blockedAround(viewer)]);
  if (!friends.length) return [];
  const owners = await User.find({ _id: { $in: friends.filter((f) => !blocked.has(f)) }, status: { $ne: "blocked" } }, { privacy: 1 }).lean<UserDoc[]>();
  const sharing = owners.filter((o) => canSee("friends", privacyOf(o).friendsSee, "activity")).map((o) => o._id);
  if (!sharing.length) return [];

  const since = new Date(Date.now() - STRIP_DAYS * 86_400_000);
  const rows = await Activity.find({ uid: { $in: sharing }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(limit * 4).lean();
  if (!rows.length) return [];

  // Belt and braces: whatever is hidden right now never shows, even if its activity outlived the change.
  const pairs = rows.map((r) => ({ uid: r.uid, key: r.key }));
  const [hiddenLib, hiddenWl] = await Promise.all([
    LibraryItem.find({ $or: pairs, hiddenFromFriends: true }, { uid: 1, key: 1 }).lean(),
    WatchlistItem.find({ $or: pairs, hiddenFromFriends: true }, { uid: 1, key: 1 }).lean(),
  ]);
  const hidden = new Set([...hiddenLib, ...hiddenWl].map((h) => `${h.uid}|${h.key}`));
  const visible = rows.filter((r) => !hidden.has(`${r.uid}|${r.key}`));

  // One line per person and title: the latest thing they did with it.
  const seen = new Set<string>();
  const latest = visible.filter((r) => {
    const id = `${r.uid}|${r.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const [people, titles] = await Promise.all([
    peopleByUid(latest.map((r) => r.uid)),
    (await titlesCol()).find({ _id: { $in: latest.map((r) => r.key as TitleKey) } }, { projection: CARD_PROJECTION }).toArray(),
  ]);
  const cards = new Map(titles.map((t) => [t._id as string, toCard(t)]));
  return latest
    .flatMap((r) => {
      const person = people.get(r.uid);
      const card = cards.get(r.key);
      return person && card ? [{ id: String(r._id), person, type: r.type as ActivityType, card, rating: r.rating ?? null, at: new Date(r.createdAt).toISOString() }] : [];
    })
    .slice(0, limit);
}
