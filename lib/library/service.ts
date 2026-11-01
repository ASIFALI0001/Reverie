import "server-only";
import { connectDb } from "@/lib/db/connect";
import { CustomShelf, LibraryItem, WatchlistItem, type LibraryStatus } from "@/lib/db/models/Library";
import { ensureTitle } from "@/lib/catalog/ensure";
import { CARD_PROJECTION, titlesCol, type TitleDoc } from "@/lib/db/titles";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { shelvesFor, parseShelf } from "@/lib/library/shelves";
import { titleKey, type Category, type MediaType, type TitleKey } from "@/lib/catalog/types";
import { notFound } from "@/lib/http/errors";
import { markTasteDirty } from "@/lib/reco/taste-dirty";
import { getQuickScores } from "@/lib/reco/match-engine";
import { forgetActivity, recordActivity } from "@/lib/social/activity";

export type LibraryEntry = {
  key: TitleKey;
  status: LibraryStatus;
  rating: number | null;
  /** The viewer's review, in their own words. */
  note: string;
  /** Quick reactions: what worked, what didn't (ids from lib/library/reactions). */
  worked: string[];
  didnt: string[];
  watchedAt: string | null;
  rewatchCount: number;
  addedAt: string;
  shelves: string[];
  customShelves: string[];
  card: TitleCard;
  imdb: number | null;
  episodes: number | null;
  /** Personal match, filled in by the match engine when available. */
  match: number | null;
  /** Never shown to friends or used in friend features. */
  hiddenFromFriends: boolean;
  /** Series: where the viewer is. */
  progress: { season: number; episode: number } | null;
};

export type WatchlistEntry = {
  key: TitleKey;
  addedAt: string;
  priority: number;
  card: TitleCard;
  imdb: number | null;
  match: number | null;
  hiddenFromFriends: boolean;
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

async function titlesFor(keys: string[]) {
  const col = await titlesCol();
  const docs = await col.find({ _id: { $in: keys as TitleKey[] } }, { projection: CARD_PROJECTION }).toArray();
  return new Map(docs.map((d) => [d._id, d]));
}

async function requireTitle(mediaType: MediaType, tmdbId: number): Promise<TitleDoc> {
  const doc = await ensureTitle(titleKey(mediaType, tmdbId), { enrich: false, jikan: false });
  if (!doc) throw notFound("We couldn’t find that title.");
  return doc;
}

// ── Library ─────────────────────────────────────────────────────────────────

export type LibraryInput = {
  status?: LibraryStatus;
  rating?: number | null;
  note?: string;
  worked?: string[];
  didnt?: string[];
  watchedAt?: string | null;
  rewatchCount?: number;
  customShelves?: string[];
  hiddenFromFriends?: boolean;
};

const PLAIN_FIELDS = ["rating", "note", "worked", "didnt", "rewatchCount", "customShelves", "hiddenFromFriends"] as const;

export async function addToLibrary(uid: string, mediaType: MediaType, tmdbId: number, input: LibraryInput) {
  await connectDb();
  const doc = await requireTitle(mediaType, tmdbId);
  const now = new Date();
  const status = input.status ?? "watched";
  const set: Record<string, unknown> = {
    key: doc._id,
    category: doc.category,
    shelves: shelvesFor(doc),
    status,
  };
  for (const k of PLAIN_FIELDS) if (input[k] !== undefined) set[k] = input[k];
  if (input.watchedAt !== undefined) set.watchedAt = input.watchedAt ? new Date(input.watchedAt) : null;
  else if (status === "watched") set.watchedAt = now;

  const before = await LibraryItem.findOne({ uid, mediaType, tmdbId }, { status: 1, rating: 1, hiddenFromFriends: 1 }).lean<LibraryState>();
  await LibraryItem.updateOne(
    { uid, mediaType, tmdbId },
    { $set: set, $setOnInsert: { uid, mediaType, tmdbId, addedAt: now } },
    { upsert: true },
  );
  // Watched (or started) means it's no longer something to watch later.
  await WatchlistItem.deleteOne({ uid, mediaType, tmdbId });
  await markTasteDirty(uid);
  const entry = (await getLibraryEntries(uid, { keys: [doc._id] }))[0]!;
  await noteActivity(uid, { key: doc._id, mediaType, tmdbId }, before, entry);
  return entry;
}

export async function updateLibraryItem(uid: string, mediaType: MediaType, tmdbId: number, input: LibraryInput) {
  await connectDb();
  const set: Record<string, unknown> = {};
  for (const k of ["status", ...PLAIN_FIELDS] as const) if (input[k] !== undefined) set[k] = input[k];
  if (input.watchedAt !== undefined) set.watchedAt = input.watchedAt ? new Date(input.watchedAt) : null;
  const before = await LibraryItem.findOneAndUpdate({ uid, mediaType, tmdbId }, { $set: set }, { projection: { status: 1, rating: 1, hiddenFromFriends: 1 } }).lean<LibraryState>();
  if (!before) throw notFound("That title isn’t in your library.");
  await markTasteDirty(uid);
  const key = titleKey(mediaType, tmdbId);
  const entry = (await getLibraryEntries(uid, { keys: [key] }))[0]!;
  await noteActivity(uid, { key, mediaType, tmdbId }, before, entry);
  return entry;
}

type LibraryState = { status: LibraryStatus; rating?: number | null; hiddenFromFriends?: boolean };

/**
 * What friends may see happen: a title watched or started, or a new rating. Re-saving without
 * a change posts nothing; hiding a title takes its activity down with it.
 */
async function noteActivity(uid: string, title: { key: TitleKey; mediaType: MediaType; tmdbId: number }, before: LibraryState | null, after: LibraryEntry) {
  if (after.hiddenFromFriends) {
    if (!before?.hiddenFromFriends) await forgetActivity(uid, title.key);
    return;
  }
  if (!before || before.status !== after.status) {
    if (after.status === "watched" || after.status === "watching") await recordActivity(uid, after.status === "watching" ? "started" : "watched", title, after.rating);
    return;
  }
  if (after.rating != null && after.rating !== (before.rating ?? null)) await recordActivity(uid, "rated", title, after.rating);
}

export async function removeFromLibrary(uid: string, mediaType: MediaType, tmdbId: number) {
  await connectDb();
  await LibraryItem.deleteOne({ uid, mediaType, tmdbId });
  await markTasteDirty(uid);
  await forgetActivity(uid, titleKey(mediaType, tmdbId));
}

export type LibraryQuery = {
  category?: Category;
  shelf?: string;
  customShelf?: string;
  status?: LibraryStatus;
  keys?: TitleKey[];
};

export async function getLibraryEntries(uid: string, q: LibraryQuery = {}): Promise<LibraryEntry[]> {
  await connectDb();
  const filter: Record<string, unknown> = { uid };
  if (q.category) filter.category = q.category;
  if (q.shelf && parseShelf(q.shelf)) filter.shelves = q.shelf;
  if (q.customShelf) filter.customShelves = q.customShelf;
  if (q.status) filter.status = q.status;
  if (q.keys) filter.key = { $in: q.keys };
  const items = await LibraryItem.find(filter).sort({ addedAt: -1 }).limit(2000).lean();
  const titles = await titlesFor(items.map((i) => i.key));
  return items.flatMap((i) => {
    const t = titles.get(i.key as TitleKey);
    if (!t) return [];
    return [
      {
        key: i.key as TitleKey,
        status: i.status as LibraryStatus,
        rating: i.rating ?? null,
        note: i.note ?? "",
        worked: i.worked ?? [],
        didnt: i.didnt ?? [],
        watchedAt: iso(i.watchedAt),
        rewatchCount: i.rewatchCount ?? 0,
        addedAt: iso(i.addedAt)!,
        shelves: i.shelves ?? [],
        customShelves: i.customShelves ?? [],
        card: toCard(t),
        imdb: t.ratings?.imdb ?? null,
        episodes: t.episodes ?? null,
        match: null,
        hiddenFromFriends: Boolean(i.hiddenFromFriends),
        progress: i.progress?.season != null && i.progress?.episode != null ? { season: i.progress.season, episode: i.progress.episode } : null,
      },
    ];
  });
}

/** Library / watchlist state for specific titles (hero buttons, poster badges). */
export async function libraryStatus(uid: string, keys: TitleKey[]) {
  await connectDb();
  const [lib, wl] = await Promise.all([
    LibraryItem.find({ uid, key: { $in: keys } }, { key: 1, status: 1, rating: 1 }).lean(),
    WatchlistItem.find({ uid, key: { $in: keys } }, { key: 1 }).lean(),
  ]);
  const out: Record<string, { library: { status: LibraryStatus; rating: number | null } | null; watchlist: boolean }> = {};
  for (const k of keys) out[k] = { library: null, watchlist: false };
  for (const i of lib) out[i.key] = { ...out[i.key]!, library: { status: i.status as LibraryStatus, rating: i.rating ?? null } };
  for (const w of wl) out[w.key] = { ...out[w.key]!, watchlist: true };
  return out;
}

// ── Overview: shelf index + stats ───────────────────────────────────────────

export type LibraryOverview = {
  total: number;
  categories: Record<Category, number>;
  /** Shelf slug → count, per category. */
  shelves: Record<Category, Record<string, number>>;
  collectionNames: Record<string, string>;
  custom: { id: string; name: string; count: number }[];
  stats: {
    hoursWatched: number;
    rated: number;
    averageRating: number | null;
    topGenres: { slug: string; count: number }[];
    months: { month: string; added: number; avgRating: number | null }[];
  };
};

export async function libraryOverview(uid: string): Promise<LibraryOverview> {
  await connectDb();
  const [items, custom] = await Promise.all([
    LibraryItem.find({ uid }, { key: 1, category: 1, shelves: 1, customShelves: 1, status: 1, rating: 1, addedAt: 1, watchedAt: 1 }).lean(),
    CustomShelf.find({ uid }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);
  const titles = await titlesFor(items.map((i) => i.key));

  const categories: Record<Category, number> = { movie: 0, series: 0, anime: 0, cartoon: 0 };
  const shelves: Record<Category, Record<string, number>> = { movie: {}, series: {}, anime: {}, cartoon: {} };
  const collectionNames: Record<string, string> = {};
  const genreCounts = new Map<string, number>();
  const customCounts = new Map<string, number>();
  let minutes = 0;
  let ratedSum = 0;
  let rated = 0;

  for (const i of items) {
    const cat = i.category as Category;
    categories[cat]++;
    for (const s of i.shelves ?? []) shelves[cat][s] = (shelves[cat][s] ?? 0) + 1;
    for (const c of i.customShelves ?? []) customCounts.set(c, (customCounts.get(c) ?? 0) + 1);
    const t = titles.get(i.key as TitleKey);
    if (t?.collection) collectionNames[String(t.collection.id)] = t.collection.name;
    if (i.status === "watched" && t?.runtime) minutes += t.mediaType === "tv" ? t.runtime * (t.episodes ?? 1) : t.runtime;
    if (i.status !== "dropped") for (const s of i.shelves ?? []) if (s.startsWith("genre:")) genreCounts.set(s, (genreCounts.get(s) ?? 0) + 1);
    if (i.rating != null) {
      ratedSum += i.rating;
      rated++;
    }
  }

  // Only collections with at least two titles earn their own shelf.
  for (const cat of Object.keys(shelves) as Category[]) {
    for (const [s, n] of Object.entries(shelves[cat])) if (s.startsWith("collection:") && n < 2) delete shelves[cat][s];
  }

  // Twelve months of "taste over time": titles added and their average rating.
  // Buckets are UTC months so the "YYYY-MM" key always matches the range it counts.
  const months: LibraryOverview["stats"]["months"] = [];
  const now = new Date();
  for (let m = 11; m >= 0; m--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m + 1, 1));
    const inMonth = items.filter((i) => {
      const d = new Date(i.watchedAt ?? i.addedAt);
      return d >= start && d < end;
    });
    const ratings = inMonth.map((i) => i.rating).filter((r): r is number => r != null);
    months.push({
      month: start.toISOString().slice(0, 7),
      added: inMonth.length,
      avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    });
  }

  return {
    total: items.length,
    categories,
    shelves,
    collectionNames,
    custom: custom.map((c) => ({ id: String(c._id), name: c.name, count: customCounts.get(String(c._id)) ?? 0 })),
    stats: {
      hoursWatched: Math.round(minutes / 60),
      rated,
      averageRating: rated ? Math.round((ratedSum / rated) * 10) / 10 : null,
      topGenres: [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([slug, count]) => ({ slug, count })),
      months,
    },
  };
}

// ── Custom shelves ──────────────────────────────────────────────────────────

export async function createShelf(uid: string, name: string) {
  await connectDb();
  const count = await CustomShelf.countDocuments({ uid });
  const shelf = await CustomShelf.create({ uid, name: name.trim(), order: count });
  return { id: String(shelf._id), name: shelf.name, count: 0 };
}

export async function renameShelf(uid: string, id: string, name: string) {
  await connectDb();
  const res = await CustomShelf.updateOne({ _id: id, uid }, { $set: { name: name.trim() } });
  if (res.matchedCount === 0) throw notFound("Shelf not found.");
}

export async function deleteShelf(uid: string, id: string) {
  await connectDb();
  await CustomShelf.deleteOne({ _id: id, uid });
  await LibraryItem.updateMany({ uid, customShelves: id }, { $pull: { customShelves: id } });
}

// ── Watchlist ───────────────────────────────────────────────────────────────

export async function addToWatchlist(uid: string, mediaType: MediaType, tmdbId: number, opts: { hiddenFromFriends?: boolean } = {}) {
  await connectDb();
  const doc = await requireTitle(mediaType, tmdbId);
  const res = await WatchlistItem.updateOne(
    { uid, mediaType, tmdbId },
    {
      $setOnInsert: { uid, mediaType, tmdbId, key: doc._id, category: doc.category, addedAt: new Date() },
      ...(opts.hiddenFromFriends !== undefined ? { $set: { hiddenFromFriends: opts.hiddenFromFriends } } : {}),
    },
    { upsert: true },
  );
  await markTasteDirty(uid);
  if (res.upsertedCount && !opts.hiddenFromFriends) await recordActivity(uid, "watchlisted", { key: doc._id, mediaType, tmdbId });
}

/** Hide a watchlist title from friends (or show it again). The friend-facing taste is rebuilt without it. */
export async function updateWatchlistItem(uid: string, mediaType: MediaType, tmdbId: number, input: { hiddenFromFriends: boolean }) {
  await connectDb();
  const res = await WatchlistItem.updateOne({ uid, mediaType, tmdbId }, { $set: { hiddenFromFriends: input.hiddenFromFriends } });
  if (res.matchedCount === 0) throw notFound("That title isn’t on your watchlist.");
  await markTasteDirty(uid);
  if (input.hiddenFromFriends) await forgetActivity(uid, titleKey(mediaType, tmdbId));
  return { hiddenFromFriends: input.hiddenFromFriends };
}

export async function removeFromWatchlist(uid: string, mediaType: MediaType, tmdbId: number) {
  await connectDb();
  await WatchlistItem.deleteOne({ uid, mediaType, tmdbId });
  await markTasteDirty(uid);
  await forgetActivity(uid, titleKey(mediaType, tmdbId), "watchlisted");
}

export async function getWatchlist(uid: string): Promise<WatchlistEntry[]> {
  await connectDb();
  const items = await WatchlistItem.find({ uid }).sort({ addedAt: -1 }).limit(1000).lean();
  const keys = items.map((i) => i.key as TitleKey);
  const [titles, scores] = await Promise.all([
    titlesFor(keys),
    // Ranked by match (brief §5.6); a scoring hiccup just leaves the list in date order.
    getQuickScores(uid, keys.slice(0, 80)).catch((err) => {
      console.warn("[watchlist] match scores unavailable", err);
      return {} as Record<string, number>;
    }),
  ]);
  return items.flatMap((i) => {
    const t = titles.get(i.key as TitleKey);
    if (!t) return [];
    return [
      {
        key: i.key as TitleKey,
        addedAt: iso(i.addedAt)!,
        priority: i.priority ?? 0,
        card: toCard(t),
        imdb: t.ratings?.imdb ?? null,
        match: scores[i.key] ?? null,
        hiddenFromFriends: Boolean(i.hiddenFromFriends),
      },
    ];
  });
}
