import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import { ensureTitles, refreshRatings } from "@/lib/catalog/ensure";
import { toCard } from "@/lib/catalog/cards";
import { categorize } from "@/lib/catalog/category";
import { foldDiacritics, formatRuntime } from "@/lib/format";
import { titleKey, type Category, type MediaType, type TitleKey } from "@/lib/catalog/types";
import { getGenres, getList, searchMulti, searchTitles, type TmdbListItem, type TmdbParams } from "@/lib/sources/tmdb";
import { INTERACTIVE_EMBED_MS, embedQuery } from "@/lib/ai/embed";
import { judgeForViewer, rankForRequest, understandQuery, type AskCandidate, type Understanding } from "@/lib/ai/ask";
import { blendMatch } from "@/lib/reco/match-math";
import { featureProfile } from "@/lib/reco/features";
import { getCatalogSample } from "@/lib/reco/catalog-sample";
import { hasTaste, quickParts, reactionsFor } from "@/lib/reco/match-engine";
import { getFreshProfile, keepAlive } from "@/lib/reco/taste";
import { dot, normalize, percentileRank, percentileTable, weightedMean } from "@/lib/reco/vector";
import { vectorSearch, type VectorFilter } from "@/lib/reco/vector-search";
import {
  askOrder,
  avoids,
  genreFit,
  passesConstraints,
  quality,
  retrievalScore,
  tagFit,
  widenGenres,
  type Constraints,
} from "@/lib/reco/ask-score";
import type { AskEvent, AskItem } from "@/lib/search/types";
import type { TasteProfileDoc } from "@/lib/db/taste";

const SHOW = 10;
const RANK = 30;
const RATINGS_BUDGET_MS = 3000;

type Doc = TitleDoc & { embedding?: number[] };

const PROJECTION = {
  title: 1, year: 1, category: 1, mediaType: 1, tmdbId: 1, runtime: 1, seasons: 1, genres: 1, keywords: 1, vibe: 1,
  originalLanguage: 1, voteAverage: 1, voteCount: 1, posterPath: 1, posterBlur: 1, colors: 1, ratings: 1, imdbId: 1,
  ratingsUpdatedAt: 1, directors: 1, creators: 1, topCast: 1, collection: 1, franchises: 1, tmdbRecs: 1, tmdbSimilar: 1,
  embedding: 1,
} as const;

const norm = (s: string) => foldDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * "A movie like Jurassic World but scarier" (brief §5.5), as a stream:
 * understanding → provisional candidates → ranked for the request → final, with the viewer's match.
 */
export async function* askReverie({ query, uid }: { query: string; uid: string | null }): AsyncGenerator<AskEvent> {
  const started = Date.now();

  // 1 · Understand (with a plain reading if Gemini is unavailable).
  let u: Understanding;
  try {
    u = await understandQuery(query);
  } catch (err) {
    console.warn("[ask] understanding fell back:", err instanceof Error ? err.message.slice(0, 120) : err);
    u = plainReading(query);
  }
  const refs = await resolveReferences(u.referenceTitles);
  yield {
    type: "understanding",
    chips: u.chips.length ? u.chips : refs.map((r) => `like: ${r.title}`),
    references: refs.map((r) => ({ key: r._id, title: r.title, year: r.year })),
  };

  // 2 · Retrieve, filter, and pre-rank.
  const constraints: Constraints = {
    format: u.format,
    genres: widenGenres(u.mustHave.genres),
    tags: [...u.mustHave.themes, ...u.mustHave.mood].map((t) => t.toLowerCase()),
    avoid: u.avoid.map((a) => a.toLowerCase()),
    runtimeMax: u.runtimeMax,
    yearFrom: u.yearRange?.from ?? null,
    yearTo: u.yearRange?.to ?? null,
    language: u.language,
  };
  const { docs, queryVector } = await retrieve(u, refs, constraints);
  const table = queryVector ? percentileTable((await getCatalogSample()).map((v) => dot(queryVector, v))) : null;
  const scored = docs
    .filter((d) => passesConstraints(d, constraints) && !poorlyReceived(d))
    .map((d) => ({
      d,
      r: retrievalScore({
        vector: table && queryVector && d.embedding?.length ? percentileRank(dot(queryVector, d.embedding), table) : null,
        tags: tagFit(d, constraints),
        genres: genreFit(d, constraints),
        quality: quality(d),
        avoided: avoids(d, constraints),
      }),
    }))
    .sort((a, b) => b.r - a.r)
    .slice(0, RANK);

  const profile = uid ? await getFreshProfile(uid) : null;
  const personal = hasTaste(profile);
  const fp = personal ? featureProfile(profile) : null;
  const quick = new Map(scored.map(({ d }) => [d._id, personal ? quickParts(profile, d, fp!) : null]));
  const item = (d: Doc, extra: Partial<AskItem> = {}): AskItem => ({
    key: d._id,
    card: toCard(d),
    imdb: d.ratings?.imdb ?? null,
    fit: null,
    match: quick.get(d._id)?.score ?? null,
    matchKind: personal ? "quick" : null,
    why: null,
    ...extra,
  });
  yield { type: "candidates", items: scored.slice(0, SHOW).map(({ d }) => item(d)) };
  if (!scored.length) {
    yield { type: "final", items: [], personal, ms: Date.now() - started };
    return;
  }

  // 3 · Re-rank for fit to the request (falls back to the retrieval order).
  const byKey = new Map(scored.map(({ d }) => [d._id, d]));
  let ranked: { d: Doc; fit: number | null; why: string | null }[];
  try {
    const order = await rankForRequest(query, describeReading(u, refs), scored.map(({ d }) => candidate(d)));
    ranked = order.map((o) => ({ d: byKey.get(o.id as TitleKey)!, fit: o.fit, why: o.why }));
    // Always ten when we have them: top up from the retrieval order, just below Gemini's picks.
    const floor = Math.min(...ranked.map((r) => r.fit ?? 100), 100);
    for (const { d } of scored) {
      if (ranked.length >= SHOW) break;
      if (ranked.some((r) => r.d._id === d._id)) continue;
      ranked.push({ d, fit: Math.max(0, floor - 5), why: plainWhy(d, constraints) });
    }
  } catch (err) {
    console.warn("[ask] fit ranking fell back:", err instanceof Error ? err.message.slice(0, 120) : err);
    ranked = scored.map(({ d, r }) => ({ d, fit: Math.round(Math.min(1, Math.max(0, r)) * 100), why: null }));
  }
  const ordered = (match: (k: TitleKey) => number | null) =>
    [...ranked].sort((a, b) => askOrder(b.fit, match(b.d._id)) - askOrder(a.fit, match(a.d._id)));
  const top = ordered((k) => quick.get(k)?.score ?? null).slice(0, SHOW);
  yield { type: "ranked", items: top.map(({ d, fit, why }) => item(d, { fit, why })) };

  // 4 · The viewer's match on the top results (one batched judgement), then the final order.
  const full = new Map<TitleKey, number>();
  if (personal) {
    try {
      const { loved, disliked } = await tasteExamples(profile);
      const scores = await judgeForViewer({
        summary: profile.tasteSummary,
        dna: profile.tasteDNA,
        loved,
        disliked,
        titles: top.map(({ d }) => candidate(d)),
      });
      if (scores.size < top.length) console.warn(`[ask] judgement covered ${scores.size} of ${top.length} titles`, [...scores.keys()].slice(0, 3));
      for (const { d } of top) {
        const llm = scores.get(d._id);
        const q = quick.get(d._id);
        if (llm != null && q) full.set(d._id, blendMatch({ vector: q.vector, features: q.features, llm: llm / 100 }));
      }
    } catch (err) {
      console.warn("[ask] personal judgement fell back to quick scores:", err instanceof Error ? err.message.slice(0, 120) : err);
    }
  }
  const finalOrder = ordered((k) => full.get(k) ?? quick.get(k)?.score ?? null).slice(0, SHOW);
  const withRatings = await freshRatings(finalOrder.map(({ d }) => d));
  yield {
    type: "final",
    personal,
    ms: Date.now() - started,
    items: finalOrder.map(({ d, fit, why }) =>
      item(withRatings.get(d._id) ?? d, {
        fit,
        why,
        match: full.get(d._id) ?? quick.get(d._id)?.score ?? null,
        matchKind: personal ? (full.has(d._id) ? "full" : "quick") : null,
      }),
    ),
  };

  if (uid) await rememberSearch(uid, query);
}

/** A minimal reading when the model is unavailable: a "like X" reference and an obvious format. */
function plainReading(query: string): Understanding {
  const like = /\blike\s+(.+?)(?:\s+but\b|\s+with\b|\s+and\b|[,.;!?]|$)/i.exec(query)?.[1]?.trim();
  const format = /\banime\b/i.test(query) ? "anime" : /\b(series|show|tv)\b/i.test(query) ? "series" : /\bmovie|film\b/i.test(query) ? "movie" : "any";
  return {
    referenceTitles: like ? [{ title: like, year: null, kind: format === "series" ? "tv" : format === "movie" ? "movie" : "any" }] : [],
    mustHave: { genres: [], themes: [], mood: [] },
    avoid: [],
    format,
    runtimeMax: null,
    yearRange: null,
    language: null,
    rewrittenQuery: query,
    chips: like ? [`like: ${like}`] : [],
  };
}

type Ref = Doc;

/** Find each named reference on TMDB (best title match among the well-known results). */
async function resolveReferences(refs: Understanding["referenceTitles"]): Promise<Ref[]> {
  const keys: TitleKey[] = [];
  for (const ref of refs.slice(0, 3)) {
    try {
      const page = ref.kind === "any" ? await searchMulti(ref.title) : await searchTitles(ref.title, ref.kind, ref.year);
      const want = norm(ref.title);
      const hits = page.results
        .filter((r: TmdbListItem) => (ref.kind === "any" ? r.media_type === "movie" || r.media_type === "tv" : true) && r.poster_path)
        .slice(0, 8)
        .map((r) => ({ r, mediaType: (ref.kind === "any" ? r.media_type : ref.kind) as MediaType }))
        .sort((a, b) => {
          const exact = (x: TmdbListItem) => (norm(x.title ?? x.name ?? "") === want ? 1 : 0);
          return exact(b.r) - exact(a.r) || (b.r.vote_count ?? 0) - (a.r.vote_count ?? 0);
        });
      if (hits[0]) keys.push(titleKey(hits[0].mediaType, hits[0].r.id));
    } catch {
      // An unresolvable reference just doesn't steer the search.
    }
  }
  if (!keys.length) return [];
  await ensureTitles(keys, { enrich: false, colors: false, jikan: false });
  keepAlive(ensureTitles(keys, { jikan: false })); // vibes + embeddings for next time
  const titles = await titlesCol();
  const docs = (await titles.find({ _id: { $in: keys } }, { projection: PROJECTION }).toArray()) as Ref[];
  return keys.flatMap((k) => docs.filter((d) => d._id === k));
}

async function retrieve(u: Understanding, refs: Ref[], c: Constraints): Promise<{ docs: Doc[]; queryVector: number[] | null }> {
  const titles = await titlesCol();
  const refKeys = new Set(refs.map((r) => r._id));

  // The query's meaning: the rewritten request (if the embedding quota allows) averaged with the references.
  const vectors = refs.flatMap((r) => (r.embedding?.length ? [r.embedding] : []));
  try {
    vectors.push(await embedQuery(u.rewrittenQuery, { budgetMs: INTERACTIVE_EMBED_MS }));
  } catch (err) {
    console.warn("[ask] query embedding unavailable:", err instanceof Error ? err.message.slice(0, 120) : err);
  }
  const queryVector = vectors.length ? normalize(weightedMean(vectors, vectors.map(() => 1))) : null;

  const keys = new Set<TitleKey>();
  if (queryVector) {
    const filter: VectorFilter = {};
    if (c.format !== "any") filter.category = c.format;
    if (c.yearFrom || c.yearTo) filter.year = { ...(c.yearFrom ? { $gte: c.yearFrom } : {}), ...(c.yearTo ? { $lte: c.yearTo } : {}) };
    if (c.language) filter.originalLanguage = c.language;
    for (const h of await vectorSearch(queryVector, { limit: 60, filter, exclude: [...refKeys] })) keys.add(h.key);
  } else {
    // No vector at all: the catalog's own tags and genres stand in.
    const genres = widenGenres(u.mustHave.genres);
    const found = await titles
      .find(
        {
          ...(c.format !== "any" ? { category: c.format } : {}),
          ...(genres.length ? { genres: { $in: genres } } : {}),
          vibe: { $ne: null },
        },
        { projection: { _id: 1 } },
      )
      .sort({ voteCount: -1 })
      .limit(80)
      .toArray();
    for (const d of found) keys.add(d._id);
  }
  for (const r of refs) for (const k of [...(r.tmdbRecs ?? []), ...(r.tmdbSimilar ?? [])].slice(0, 20)) keys.add(k);
  for (const k of await discover(u, c)) keys.add(k);
  for (const k of refKeys) keys.delete(k);

  const all = [...keys];
  let docs = (await titles.find({ _id: { $in: all } }, { projection: PROJECTION }).toArray()) as Doc[];
  const missing = all.filter((k) => !docs.some((d) => d._id === k)).slice(0, 40);
  if (missing.length) {
    await ensureTitles(missing, { enrich: false, colors: false, jikan: false });
    docs = docs.concat((await titles.find({ _id: { $in: missing } }, { projection: PROJECTION }).toArray()) as Doc[]);
    keepAlive(ensureTitles(missing, { jikan: false }));
  }
  return { docs, queryVector };
}

/** TMDB discover with the parsed filters: catches good fits our catalog hasn't met yet. */
async function discover(u: Understanding, c: Constraints): Promise<TitleKey[]> {
  const types: MediaType[] = c.format === "movie" ? ["movie"] : c.format === "series" ? ["tv"] : ["movie", "tv"];
  const out: TitleKey[] = [];
  await Promise.all(
    types.map(async (mediaType) => {
      try {
        const { genres } = await getGenres(mediaType);
        const id = (name: string) => genres.find((g) => g.name.toLowerCase() === name.toLowerCase())?.id;
        const wanted = widenGenres(u.mustHave.genres).map(id).filter((x): x is number => x != null).slice(0, 2);
        if (c.format === "anime" || c.format === "cartoon") wanted.unshift(16);
        const avoided = u.avoid.map(id).filter((x): x is number => x != null);
        const dateKey = mediaType === "movie" ? "primary_release_date" : "first_air_date";
        const params: TmdbParams = {
          sort_by: "popularity.desc",
          "vote_count.gte": 150,
          with_genres: [...new Set(wanted)].join(","),
          without_genres: avoided.join(","),
          with_original_language: c.format === "anime" ? "ja" : (c.language ?? undefined),
          "with_runtime.lte": mediaType === "movie" ? (c.runtimeMax ?? undefined) : undefined,
          [`${dateKey}.gte`]: c.yearFrom ? `${c.yearFrom}-01-01` : undefined,
          [`${dateKey}.lte`]: c.yearTo ? `${c.yearTo}-12-31` : undefined,
        };
        const page = await getList(`/discover/${mediaType}`, params);
        for (const r of page.results.slice(0, 20)) {
          const category = categorize({ mediaType, genreIds: r.genre_ids ?? [], originCountry: r.origin_country ?? [], originalLanguage: r.original_language ?? "" });
          if (c.format === "any" || category === c.format) out.push(titleKey(mediaType, r.id));
        }
      } catch {
        // Discover is a bonus source.
      }
    }),
  );
  return out;
}

function kindOf(category: Category, mediaType: MediaType) {
  if (category === "anime") return mediaType === "movie" ? "anime film" : "anime series";
  if (category === "cartoon") return mediaType === "movie" ? "animated film" : "animated series";
  return mediaType === "movie" ? "film" : "series";
}

function candidate(d: Doc): AskCandidate {
  return {
    id: d._id,
    title: d.title,
    year: d.year,
    kind: kindOf(d.category, d.mediaType),
    genres: d.genres,
    runtime: d.mediaType === "movie" ? formatRuntime(d.runtime) : d.seasons ? `${d.seasons} season${d.seasons === 1 ? "" : "s"}` : null,
    vibe: d.vibe?.summary ?? null,
    tags: [...(d.vibe?.themes ?? []), ...(d.vibe?.mood ?? [])],
    rating: d.voteCount >= 20 ? `TMDB ${d.voteAverage.toFixed(1)}/10` : null,
  };
}

/** Plenty of people have seen it, and most didn't like it. */
const poorlyReceived = (d: Doc) => d.voteCount >= 30 && d.voteAverage > 0 && d.voteAverage < 5.2;

/** A plain "why" for results Gemini didn't comment on: what they share with the request. */
function plainWhy(d: Doc, c: Constraints): string {
  const tags = [...(d.vibe?.themes ?? []), ...(d.vibe?.mood ?? [])];
  const shared = tags.filter((t) => c.tags.some((w) => t.toLowerCase().includes(w) || w.includes(t.toLowerCase()))).slice(0, 2);
  if (shared.length) return `Brings the ${shared.join(" and ")} you asked for`;
  const genres = d.genres.filter((g) => c.genres.includes(g)).slice(0, 2);
  if (genres.length) return `${genres.join(" and ")} close to what you described`;
  return "Close in feel to what you described";
}

function describeReading(u: Understanding, refs: Ref[]): string {
  return [
    refs.length ? `like ${refs.map((r) => `${r.title}${r.year ? ` (${r.year})` : ""}`).join(" and ")}` : null,
    u.mustHave.genres.length ? `genres: ${u.mustHave.genres.join(", ")}` : null,
    u.mustHave.themes.length || u.mustHave.mood.length ? `feel: ${[...u.mustHave.themes, ...u.mustHave.mood].join(", ")}` : null,
    u.avoid.length ? `avoid: ${u.avoid.join(", ")}` : null,
    u.format !== "any" ? `format: ${u.format}` : null,
    u.runtimeMax ? `under ${u.runtimeMax} minutes` : null,
    u.yearRange ? `years ${u.yearRange.from ?? "…"}–${u.yearRange.to ?? "…"}` : null,
    u.language ? `language: ${u.language}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Titles the viewer loved and disliked, for the batched judgement. */
async function tasteExamples(p: TasteProfileDoc): Promise<{ loved: string[]; disliked: string[] }> {
  const sorted = [...p.signals].sort((a, b) => b.weight - a.weight);
  const lovedKeys = sorted.filter((s) => s.weight >= 0.6).slice(0, 10).map((s) => s.key);
  const dislikedKeys = sorted.filter((s) => s.weight < 0).slice(-5).map((s) => s.key);
  const titles = await titlesCol();
  const [docs, reactions] = await Promise.all([
    titles.find({ _id: { $in: [...lovedKeys, ...dislikedKeys] } }, { projection: { title: 1, year: 1 } }).toArray(),
    reactionsFor(p.uid, [...lovedKeys, ...dislikedKeys]),
  ]);
  // "Iron Man 3 (2013): worked: humour, dialogue": why they felt that way, when they said.
  const name = (k: TitleKey) => {
    const d = docs.find((x) => x._id === k);
    if (!d) return null;
    const said = reactions.get(k);
    return `${d.title}${d.year ? ` (${d.year})` : ""}${said ? `: ${said}` : ""}`;
  };
  return {
    loved: lovedKeys.map(name).filter((x): x is string => !!x),
    disliked: dislikedKeys.map(name).filter((x): x is string => !!x),
  };
}

/** IMDb ratings for the shown results (OMDb, cached weekly), within a small time budget. */
async function freshRatings(docs: Doc[]): Promise<Map<TitleKey, Doc>> {
  const refreshed = Promise.all(docs.map((d) => refreshRatings(d).catch(() => d)));
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), RATINGS_BUDGET_MS));
  const result = await Promise.race([refreshed, timeout]);
  return new Map((result ?? docs).map((d) => [d._id, d as Doc]));
}

type HistoryDoc = { uid: string; query: string; createdAt: Date };

/** Recent searches, newest first; we keep twenty per viewer. */
export async function rememberSearch(uid: string, query: string) {
  await connectDb();
  const col = mongoose.connection.db!.collection<HistoryDoc>("searchHistory");
  await col.deleteMany({ uid, query });
  await col.insertOne({ uid, query, createdAt: new Date() });
  const old = await col.find({ uid }, { projection: { _id: 1 } }).sort({ createdAt: -1 }).skip(20).toArray();
  if (old.length) await col.deleteMany({ _id: { $in: old.map((o) => o._id) } });
}

export async function recentSearches(uid: string, limit = 8): Promise<string[]> {
  await connectDb();
  const col = mongoose.connection.db!.collection<HistoryDoc>("searchHistory");
  return (await col.find({ uid }).sort({ createdAt: -1 }).limit(limit).toArray()).map((d) => d.query);
}

export async function clearSearches(uid: string) {
  await connectDb();
  await mongoose.connection.db!.collection<HistoryDoc>("searchHistory").deleteMany({ uid });
}
