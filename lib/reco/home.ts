import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import { LibraryItem, WatchlistItem } from "@/lib/db/models/Library";
import type { TasteProfileDoc } from "@/lib/db/taste";
import { ensureTitles } from "@/lib/catalog/ensure";
import { toCard } from "@/lib/catalog/cards";
import { titleKey, type Category, type TitleKey } from "@/lib/catalog/types";
import { getTrending } from "@/lib/sources/tmdb";
import { excerpt } from "@/lib/catalog/normalize";
import { explainMatch } from "@/lib/reco/explain";
import { featureProfile } from "@/lib/reco/features";
import { hasTaste, quickParts, termNames } from "@/lib/reco/match-engine";
import { getSimilar } from "@/lib/reco/similar";
import { getFreshProfile, keepAlive } from "@/lib/reco/taste";
import { toFeatures, SCORING_PROJECTION } from "@/lib/reco/title-features";
import { dotsWith, vectorSearch, type VectorFilter } from "@/lib/reco/vector-search";
import { twinsLoved } from "@/lib/twins/compute";
import { hashSeed, rng } from "@/lib/taste/deck";
import type { HomeFeed, HomeItem, HomeRow, Tonight } from "@/lib/home/types";

const ROW = 16;
const HOUR_MS = 3_600_000;

/** A title as home needs it; `tasteDot` is its similarity to the viewer's taste vector. */
type Doc = TitleDoc & { tasteDot?: number };

// No embeddings: the vector part of each score is worked out in the database (see `load`).
const CARD_PROJECTION = {
  ...SCORING_PROJECTION,
  mediaType: 1, tmdbId: 1, category: 1, posterPath: 1, posterBlur: 1, colors: 1, runtime: 1, seasons: 1, voteAverage: 1,
  voteCount: 1, popularity: 1, backdropPath: 1,
} as const;

type CacheDoc = { uid: string; profileVersion: number; feed: HomeFeed; createdAt: Date; expiresAt: Date };

async function cacheCol() {
  await connectDb();
  return mongoose.connection.db!.collection<CacheDoc>("homeCache");
}

/**
 * The home feed (brief §5.6): no LLM calls, just the taste vector, quick scores
 * and cached similar lists. Cached for an hour per taste-profile version.
 */
export async function getHomeFeed(uid: string): Promise<HomeFeed> {
  const profile = await getFreshProfile(uid);
  const version = profile?.version ?? 0;
  const cache = await cacheCol();
  const hit = await cache.findOne({ uid, profileVersion: version, expiresAt: { $gt: new Date() } });
  if (hit) return hit.feed;

  const feed = await buildFeed(uid, profile);
  const now = new Date();
  await cache.updateOne(
    { uid },
    { $set: { profileVersion: version, feed, createdAt: now, expiresAt: new Date(now.getTime() + HOUR_MS) } },
    { upsert: true },
  );
  return feed;
}

/** These titles, in order, with how close each is to `vector` when one is given. */
async function load(keys: TitleKey[], vector?: number[] | null): Promise<Doc[]> {
  if (!keys.length) return [];
  const titles = await titlesCol();
  const [docs, dots] = await Promise.all([
    titles.find({ _id: { $in: keys } }, { projection: CARD_PROJECTION }).toArray() as Promise<Doc[]>,
    vector ? dotsWith(vector, keys) : Promise.resolve(null),
  ]);
  const byKey = new Map(docs.map((d) => [d._id, d]));
  return keys
    .flatMap((k) => byKey.get(k) ?? [])
    .filter((d) => d.posterPath)
    .map((d) => (dots?.has(d._id) ? { ...d, tasteDot: dots.get(d._id) } : d));
}

/**
 * Titles found by a search against the taste vector: Atlas already measured how close each one is
 * (cosine score = (1 + cos) / 2, and both vectors are unit length), so there's nothing to work out.
 */
async function loadScored(hits: { key: TitleKey; score: number }[]): Promise<Doc[]> {
  const dots = new Map(hits.map((h) => [h.key, 2 * h.score - 1]));
  return (await load(hits.map((h) => h.key))).map((d) => ({ ...d, tasteDot: dots.get(d._id) }));
}

async function buildFeed(uid: string, profile: TasteProfileDoc | null): Promise<HomeFeed> {
  await connectDb();
  const [lib, wl] = await Promise.all([
    LibraryItem.find({ uid }, { key: 1, status: 1, rating: 1, updatedAt: 1 }).lean(),
    WatchlistItem.find({ uid }, { key: 1, addedAt: 1 }).lean(),
  ]);
  const seen = new Set<TitleKey>([...lib.map((l) => l.key as TitleKey), ...wl.map((w) => w.key as TitleKey)]);
  const personal = hasTaste(profile);
  const fp = personal ? featureProfile(profile) : null;
  const score = (d: Doc) => (personal ? quickParts(profile, d, fp!).score : null);
  const item = (d: Doc): HomeItem => ({ card: toCard(d), match: score(d) });
  const formats = profile?.answers?.formats?.length ? (profile.answers.formats as Category[]) : null;
  const vector = personal ? profile.tasteVector : null;

  const [pool, gems, trending, continuing, watchlist, because, twins] = await Promise.all([
    personal ? tastePool(profile, seen, formats) : Promise.resolve([] as Doc[]),
    personal && profile.tasteVector ? gemsPool(profile.tasteVector, seen, formats) : Promise.resolve([] as Doc[]),
    trendingDocs(vector),
    load(
      lib
        .filter((l) => l.status === "watching")
        .sort((a, b) => +((b as { updatedAt?: Date }).updatedAt ?? 0) - +((a as { updatedAt?: Date }).updatedAt ?? 0))
        .map((l) => l.key as TitleKey),
      vector,
    ),
    load(
      wl.map((w) => w.key as TitleKey),
      vector,
    ),
    personal ? becauseRows(uid, profile, lib, seen, item) : Promise.resolve([] as HomeRow[]),
    personal ? twinsDocs(uid, seen, vector) : Promise.resolve({ docs: [] as Doc[], notes: new Map<string, string>() }),
  ]);

  // Picked for you: the best quick matches from the taste neighbourhood; the first one with a still leads as "Tonight".
  const ranked = pool.map((d) => ({ d, m: score(d)! })).sort((a, b) => b.m - a.m);
  const lead = ranked.slice(0, 6).find((x) => x.d.backdropPath) ?? ranked[0];
  // Only the lead needs names (for its sentence) and its overview: one small read.
  const words = lead
    ? await (await titlesCol()).findOne({ _id: lead.d._id }, { projection: { overview: 1, directors: 1, creators: 1, topCast: { $slice: 5 }, collection: 1, franchises: 1 } })
    : null;
  const tonight: Tonight | null =
    personal && lead
      ? {
          card: toCard(lead.d),
          match: lead.m,
          reason: explainMatch(toFeatures(lead.d), fp!, termNames(words ?? lead.d)).reasons[0] ?? "A strong fit for your taste",
          overview: excerpt(words?.overview ?? "", 220),
          backdropPath: lead.d.backdropPath,
          tint: lead.d.colors ? { dark: lead.d.colors.accentDark, light: lead.d.colors.accentLight } : null,
        }
      : null;
  const picked = ranked.filter((x) => x.d._id !== lead?.d._id).slice(0, ROW);
  const pickedKeys = new Set([...(lead ? [lead.d._id] : []), ...picked.slice(0, 8).map((x) => x.d._id)]);

  const rows: HomeRow[] = [];
  // Discovery rows need a handful to be worth a rail; your own shows and watchlist count from one.
  const push = (row: HomeRow | null) => {
    if (row && row.items.length >= (row.kind === "continue" || row.kind === "watchlist" ? 1 : 3)) rows.push(row);
  };
  // "Because you loved…" rows skip what Picked already leads with.
  for (const row of because) row.items = row.items.filter((i) => !pickedKeys.has(i.card.key));
  push(personal ? { id: "picked", kind: "picked", title: "Picked for you tonight", items: picked.map((x) => ({ card: toCard(x.d), match: x.m })) } : null);
  push(because[0] ?? null);
  push(
    personal
      ? {
          id: "twins",
          kind: "twins",
          title: "Loved by your taste twins",
          href: "/taste/twins",
          items: twins.docs.filter((d) => !pickedKeys.has(d._id)).map((d) => ({ ...item(d), note: twins.notes.get(d._id) ?? null })),
        }
      : null,
  );
  push({
    id: "trending",
    kind: "trending",
    title: "Trending this week",
    items: trending.map(item).sort((a, b) => (personal ? (b.match ?? 0) - (a.match ?? 0) : 0)),
  });
  push({ id: "continue", kind: "continue", title: "Finish what you started", href: "/library", items: continuing.map(item) });
  push({
    id: "watchlist",
    kind: "watchlist",
    title: "Your watchlist, ranked",
    href: "/watchlist",
    items: watchlist
      .map(item)
      .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
      .slice(0, ROW),
  });
  push(because[1] ?? null);
  push(
    personal
      ? {
          id: "gems",
          kind: "gems",
          title: "Hidden gems for you",
          items: gems
            .filter((d) => !pickedKeys.has(d._id) && d.voteAverage >= 6.8)
            .map(item)
            .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
            .slice(0, 12),
        }
      : null,
  );
  push(because[2] ?? null);
  return { personal, tonight, rows };
}

/** Titles near the taste vector (or, without one, popular titles in the viewer's genres). */
async function tastePool(profile: TasteProfileDoc, seen: Set<TitleKey>, formats: Category[] | null): Promise<Doc[]> {
  if (profile.tasteVector) {
    const filter: VectorFilter = formats ? { category: { $in: formats } } : {};
    const hits = await vectorSearch(profile.tasteVector, { limit: 150, exclude: [...seen], filter, numCandidates: 1500 });
    return loadScored(hits);
  }
  const liked = profile.genreAffinity.filter((g) => g.value > 0.2).map((g) => g.term).slice(0, 4);
  const titles = await titlesCol();
  return (await titles
    .find(
      {
        _id: { $nin: [...seen] },
        posterPath: { $ne: null },
        ...(formats ? { category: { $in: formats } } : {}),
        ...(liked.length ? { genres: { $in: liked } } : {}),
      },
      // No taste vector to compare against, so no embeddings either.
      { projection: CARD_PROJECTION },
    )
    .sort({ voteCount: -1 })
    .limit(150)
    .toArray()) as Doc[];
}

/** Well-liked but little-known titles near the viewer's taste. */
async function gemsPool(vector: number[], seen: Set<TitleKey>, formats: Category[] | null): Promise<Doc[]> {
  // Known to a few thousand, not millions: TMDB popularity tracks current buzz, so votes carry the "hidden" part.
  const filter: VectorFilter = { voteCount: { $gte: 200, $lte: 3000 }, ...(formats ? { category: { $in: formats } } : {}) };
  const hits = await vectorSearch(vector, { limit: 60, exclude: [...seen], filter, numCandidates: 1200 });
  return loadScored(hits);
}

async function trendingDocs(vector: number[] | null): Promise<Doc[]> {
  try {
    const page = await getTrending("all", "week");
    const keys = page.results
      .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path && !r.adult)
      .slice(0, 20)
      .map((r) => titleKey(r.media_type as "movie" | "tv", r.id));
    // Show what the catalog already knows now; fetch the rest in the background for next time.
    const known = await load(keys, vector);
    const missing = keys.filter((k) => !known.some((d) => d._id === k));
    if (missing.length) keepAlive(ensureTitles(missing, { jikan: false }));
    return known;
  } catch (err) {
    console.warn("[home] trending unavailable", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * What at least two of your Taste Twins loved and you haven't logged (lib/twins), each with how
 * many of them rated it that highly: "3 twins rated this 9+" (or 8+, the bar for "loved").
 */
async function twinsDocs(uid: string, seen: Set<TitleKey>, vector: number[] | null): Promise<{ docs: Doc[]; notes: Map<string, string> }> {
  try {
    const loved = await twinsLoved(uid, seen, ROW);
    const notes = new Map(loved.map((l) => [l.key as string, l.nines >= 2 ? `${l.nines} twins rated this 9+` : `${l.raters} twins rated this 8+`]));
    return {
      docs: await load(
        loved.map((l) => l.key),
        vector,
      ),
      notes,
    };
  } catch (err) {
    console.warn("[home] twins unavailable", err instanceof Error ? err.message : err);
    return { docs: [], notes: new Map() };
  }
}

/** Up to three "Because you loved…" rows, from top-rated titles (a different few each day). */
async function becauseRows(
  uid: string,
  profile: TasteProfileDoc,
  lib: { key: string; rating?: number | null }[],
  seen: Set<TitleKey>,
  item: (d: Doc) => HomeItem,
): Promise<HomeRow[]> {
  const loved = new Set<TitleKey>([
    ...lib.filter((l) => (l.rating ?? 0) >= 9).map((l) => l.key as TitleKey),
    ...(profile.onboarding?.favourites ?? []).map((f) => f.key),
  ]);
  const liked = lib.filter((l) => (l.rating ?? 0) >= 7 && (l.rating ?? 0) < 9).map((l) => l.key as TitleKey).filter((k) => !loved.has(k));
  if (!loved.size && !liked.length) return [];
  // Rotate daily, deterministically per viewer: loved titles first, liked ones only to fill.
  const random = rng(hashSeed(`${uid}:${new Date().toISOString().slice(0, 10)}`));
  const shuffle = (keys: TitleKey[]) =>
    keys
      .map((k) => ({ k, r: random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.k);
  const pick = [...shuffle([...loved]), ...shuffle(liked)].slice(0, 3);
  const sources = await load(pick);
  const rows = await Promise.all(
    sources.map(async (src): Promise<HomeRow | null> => {
      try {
        const similar = await getSimilar(src._id, { curate: false });
        const docs = await load(
          similar.map((s) => s.key).filter((k) => !seen.has(k)),
          profile.tasteVector,
        );
        return {
          id: `because-${src._id}`,
          kind: "because",
          title: loved.has(src._id) ? "Because you loved" : "Because you liked",
          emphasis: src.title,
          href: toCard(src).href,
          items: docs.map(item),
        };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r): r is HomeRow => r != null);
}
