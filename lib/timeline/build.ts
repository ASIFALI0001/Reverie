import "server-only";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { TasteSnapshot } from "@/lib/db/models/Insights";
import { titlesCol } from "@/lib/db/titles";
import { hashInputs, monthStart, snapshotOf, type SnapshotItem } from "@/lib/timeline/snapshots";
import type { TitleKey } from "@/lib/catalog/types";

type Entry = { key: TitleKey; status: SnapshotItem["status"]; rating: number | null; at: Date };

/**
 * Bring a user's monthly snapshots up to date with their library. Only months whose
 * inputs changed are rebuilt (and only their titles' embeddings are read); months that
 * no longer have anything in them are removed.
 */
export async function rebuildSnapshots(uid: string): Promise<{ months: number; rebuilt: number }> {
  await connectDb();
  const library = await LibraryItem.find({ uid }, { key: 1, status: 1, rating: 1, watchedAt: 1, addedAt: 1 }).lean();
  const byMonth = new Map<number, Entry[]>();
  for (const l of library) {
    const at = l.watchedAt ?? l.addedAt;
    if (!at) continue;
    const start = monthStart(at).getTime();
    const entry = { key: l.key as TitleKey, status: l.status as Entry["status"], rating: l.rating ?? null, at };
    byMonth.set(start, [...(byMonth.get(start) ?? []), entry]);
  }

  const stored = new Map((await TasteSnapshot.find({ uid }, { periodStart: 1, hash: 1 }).lean()).map((s) => [s.periodStart.getTime(), s.hash]));
  const changed = [...byMonth.entries()].filter(([start, entries]) => stored.get(start) !== hashInputs(entries));

  if (changed.length) {
    const titles = await titlesCol();
    const keys = [...new Set(changed.flatMap(([, entries]) => entries.map((e) => e.key)))];
    const docs = await titles
      .find(
        { _id: { $in: keys } },
        { projection: { title: 1, posterPath: 1, genres: 1, vibe: 1, runtime: 1, episodes: 1, mediaType: 1, embedding: 1 } },
      )
      .toArray();
    const byKey = new Map(docs.map((d) => [d._id, d]));

    for (const [start, entries] of changed) {
      const items: SnapshotItem[] = entries.flatMap((e) => {
        const t = byKey.get(e.key);
        if (!t) return [];
        // Same estimate as the library's stats: a film's runtime, a series' runtime × episodes, once watched.
        const minutes = e.status === "watched" && t.runtime ? (t.mediaType === "tv" ? t.runtime * (t.episodes ?? 1) : t.runtime) : 0;
        return [
          {
            key: e.key,
            at: e.at,
            status: e.status,
            rating: e.rating,
            title: t.title,
            posterPath: t.posterPath ?? null,
            genres: t.genres ?? [],
            vibe: t.vibe ? { pace: t.vibe.pace, tone: t.vibe.tone, complexity: t.vibe.complexity } : null,
            minutes,
            embedding: (t as { embedding?: number[] }).embedding ?? null,
          },
        ];
      });
      if (!items.length) continue;
      // The stored hash covers the whole month's library entries, so a missing title doesn't force a rebuild every time.
      const snapshot = { ...snapshotOf(new Date(start), items), hash: hashInputs(entries) };
      await TasteSnapshot.updateOne({ uid, periodStart: snapshot.periodStart }, { $set: { ...snapshot, uid, updatedAt: new Date() } }, { upsert: true });
    }
  }

  await TasteSnapshot.deleteMany({ uid, periodStart: { $nin: [...byMonth.keys()].map((t) => new Date(t)) } });
  return { months: byMonth.size, rebuilt: changed.length };
}
