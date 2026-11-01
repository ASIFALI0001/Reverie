import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { Recommendation, type RECOMMENDATION_REACTIONS } from "@/lib/db/models/Social";
import { CARD_PROJECTION, titlesCol } from "@/lib/db/titles";
import { ensureTitle } from "@/lib/catalog/ensure";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { titleKey, type MediaType, type TitleKey } from "@/lib/catalog/types";
import { addToLibrary, addToWatchlist } from "@/lib/library/service";
import { getQuickScores } from "@/lib/reco/match-engine";
import { badRequest, notFound } from "@/lib/http/errors";
import { notify } from "@/lib/social/notifications";
import { peopleByUid, type Person } from "@/lib/social/people";
import { blockedAround, friendUids } from "@/lib/social/relations";

/** "Send to a friend": a title with an optional note, to one or more friends, and their quick replies. */

export type ReactionKind = (typeof RECOMMENDATION_REACTIONS)[number];
export const NOTE_MAX = 280;
const MAX_RECIPIENTS = 10;
const INBOX_LIMIT = 40;

export async function sendRecommendation(fromUid: string, input: { mediaType: MediaType; tmdbId: number; to: string[]; note?: string }) {
  await connectDb();
  const friends = new Set(await friendUids(fromUid));
  const to = [...new Set(input.to)].filter((uid) => friends.has(uid)).slice(0, MAX_RECIPIENTS);
  if (!to.length) throw badRequest("Pick at least one friend to send it to.");
  const doc = await ensureTitle(titleKey(input.mediaType, input.tmdbId), { enrich: false, jikan: false });
  if (!doc) throw notFound("We couldn’t find that title.");
  const note = (input.note ?? "").trim().slice(0, NOTE_MAX);

  for (const toUid of to) {
    // Sending the same title again before they've answered refreshes it rather than stacking a duplicate.
    const rec = await Recommendation.findOneAndUpdate(
      { fromUid, toUid, key: doc._id, reaction: null },
      { $set: { note, createdAt: new Date(), seenAt: null }, $setOnInsert: { fromUid, toUid, key: doc._id, mediaType: input.mediaType, tmdbId: input.tmdbId } },
      { upsert: true, returnDocument: "after" },
    );
    await notify(toUid, "recommendation", fromUid, { recId: String(rec!._id), key: doc._id, title: doc.title, note: note || null });
  }
  return { sent: to.length };
}

export type InboxItem = {
  id: string;
  from: Person;
  card: TitleCard;
  note: string | null;
  /** The recipient's own match for it. */
  match: number | null;
  reaction: { kind: ReactionKind; rating: number | null; at: string } | null;
  seen: boolean;
  at: string;
};

/** What friends sent you, newest first. Someone you blocked (or who blocked you) drops out. */
export async function recommendationInbox(uid: string): Promise<{ items: InboxItem[]; waiting: number }> {
  await connectDb();
  const [recs, blocked] = await Promise.all([Recommendation.find({ toUid: uid }).sort({ createdAt: -1 }).limit(INBOX_LIMIT).lean(), blockedAround(uid)]);
  const kept = recs.filter((r) => !blocked.has(r.fromUid));
  if (!kept.length) return { items: [], waiting: 0 };
  const keys = [...new Set(kept.map((r) => r.key as TitleKey))];
  const [people, titles, scores] = await Promise.all([
    peopleByUid(kept.map((r) => r.fromUid)),
    (await titlesCol()).find({ _id: { $in: keys } }, { projection: CARD_PROJECTION }).toArray(),
    getQuickScores(uid, keys.slice(0, 80)).catch(() => ({}) as Record<string, number>),
  ]);
  const cards = new Map(titles.map((t) => [t._id as string, toCard(t)]));
  const items = kept.flatMap((r) => {
    const from = people.get(r.fromUid);
    const card = cards.get(r.key);
    if (!from || !card) return [];
    return [
      {
        id: String(r._id),
        from,
        card,
        note: r.note || null,
        match: scores[r.key] ?? null,
        reaction: r.reaction ? { kind: r.reaction.kind as ReactionKind, rating: r.reaction.rating ?? null, at: new Date(r.reaction.at).toISOString() } : null,
        seen: Boolean(r.seenAt),
        at: new Date(r.createdAt).toISOString(),
      },
    ];
  });
  return { items, waiting: items.filter((i) => !i.reaction).length };
}

/**
 * Answer a recommendation: "Added to watchlist" adds it, "Watched it — 8/10" puts it in the
 * library with that rating, "Not for me" just says so. The sender hears back.
 */
export async function reactToRecommendation(uid: string, id: string, reaction: { kind: ReactionKind; rating?: number | null }) {
  if (!mongoose.isValidObjectId(id)) throw notFound("That recommendation isn’t there any more.");
  await connectDb();
  const rec = await Recommendation.findById(id).lean();
  if (!rec || rec.toUid !== uid) throw notFound("That recommendation isn’t there any more.");
  const mediaType = rec.mediaType as MediaType;
  const rating = reaction.kind === "watched" ? (reaction.rating ?? null) : null;
  if (reaction.kind === "watchlisted") await addToWatchlist(uid, mediaType, rec.tmdbId);
  if (reaction.kind === "watched") await addToLibrary(uid, mediaType, rec.tmdbId, { status: "watched", ...(rating ? { rating } : {}) });

  const now = new Date();
  await Recommendation.updateOne({ _id: id }, { $set: { reaction: { kind: reaction.kind, rating, at: now }, seenAt: rec.seenAt ?? now } });
  const doc = await (await titlesCol()).findOne({ _id: rec.key as TitleKey }, { projection: { title: 1 } });
  await notify(rec.fromUid, "recommendation_reaction", uid, { recId: id, key: rec.key, title: doc?.title ?? null, kind: reaction.kind, rating });
  return { kind: reaction.kind, rating };
}

export async function markRecommendationsSeen(uid: string, ids?: string[]) {
  await connectDb();
  const valid = (ids ?? []).filter((i) => mongoose.isValidObjectId(i));
  const filter = ids?.length ? { toUid: uid, _id: { $in: valid }, seenAt: null } : { toUid: uid, seenAt: null };
  const res = await Recommendation.updateMany(filter, { $set: { seenAt: new Date() } });
  return { marked: res.modifiedCount };
}
