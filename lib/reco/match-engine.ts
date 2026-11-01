import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import type { TasteProfileDoc } from "@/lib/db/taste";
import { ensureTitle, ensureTitles } from "@/lib/catalog/ensure";
import { excerpt } from "@/lib/catalog/normalize";
import { titleHref } from "@/lib/catalog/links";
import { FRANCHISE_NAME } from "@/lib/catalog/franchises";
import { LibraryItem } from "@/lib/db/models/Library";
import { describeReactions } from "@/lib/library/reactions";
import { formatRuntime } from "@/lib/format";
import { notFound } from "@/lib/http/errors";
import { judgeMatch, type JudgeNeighbour, type JudgeTarget } from "@/lib/ai/match-judge";
import { explainMatch, type TermNames } from "@/lib/reco/explain";
import { featureProfile, featureScore } from "@/lib/reco/features";
import { blendMatch, LEARNING_BELOW, matchConfidence } from "@/lib/reco/match-math";
import { jaccard } from "@/lib/reco/similarity";
import { getFreshProfile } from "@/lib/reco/taste";
import { SCORING_PROJECTION, toFeatures } from "@/lib/reco/title-features";
import { dot, percentileRank } from "@/lib/reco/vector";
import { dotsWith } from "@/lib/reco/vector-search";
import type { Signal } from "@/lib/reco/weights";
import type { Category, MediaType, TitleKey } from "@/lib/catalog/types";

export type MatchOk = {
  status: "ok";
  score: number;
  confidence: number;
  /** Fewer than LEARNING_BELOW signals: the UI says "Getting to know you". */
  learning: boolean;
  /** True when Gemini wasn't available and this is the vector + features estimate. */
  quick: boolean;
  reasons: string[];
  watchOut: string | null;
  becauseYouLiked: { key: TitleKey; title: string; posterPath: string | null; href: string }[];
  profileVersion: number;
  parts: { vector: number | null; features: number; llm: number | null };
};
export type MatchView = { status: "no-profile" } | MatchOk;

type CacheDoc = { uid: string; key: TitleKey; profileVersion: number; kind: "full"; result: MatchOk; createdAt: Date };

async function cacheCol() {
  await connectDb();
  return mongoose.connection.db!.collection<CacheDoc>("matchCache");
}

export const hasTaste = (p: TasteProfileDoc | null): p is TasteProfileDoc => !!p && (p.signalCount > 0 || p.answers != null);
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * The title's percentile in the viewer's own taste distribution (so scores spread, brief §5.3.1).
 * `known` is the similarity when a search against the taste vector already measured it.
 */
function vectorPart(p: TasteProfileDoc, embedding: number[] | null | undefined, known?: number): number | null {
  if (!p.tasteVector || !p.vectorPercentiles?.length) return null;
  const sim = known ?? (embedding?.length ? dot(p.tasteVector, embedding) : null);
  return sim == null ? null : round3(percentileRank(sim, p.vectorPercentiles));
}

/**
 * Vector + features for a title the caller already holds: its embedding when it has one, or
 * `tasteDot`, its similarity to this taste vector from a vector search (so the embedding can
 * stay in the database).
 */
export function quickParts(
  profile: TasteProfileDoc,
  doc: Parameters<typeof toFeatures>[0] & { embedding?: number[]; tasteDot?: number },
  fp: ReturnType<typeof featureProfile> = featureProfile(profile),
): { score: number; vector: number | null; features: number } {
  const vector = vectorPart(profile, doc.embedding, doc.tasteDot);
  const features = round3(featureScore(toFeatures(doc), fp).score);
  return { score: blendMatch({ vector, features }), vector, features };
}

const inflight = new Map<string, Promise<MatchView>>();

/** Full match for one title: vector + features + Gemini's judgement over the viewer's most similar titles. */
export async function getFullMatch(uid: string, key: TitleKey): Promise<MatchView> {
  const profile = await getFreshProfile(uid);
  if (!hasTaste(profile)) return { status: "no-profile" };
  const cache = await cacheCol();
  const hit = await cache.findOne({ uid, key, profileVersion: profile.version, kind: "full" });
  if (hit) return hit.result;

  const id = `${uid}:${key}:${profile.version}`;
  let task = inflight.get(id);
  if (!task) {
    task = computeFull(uid, key, profile).finally(() => inflight.delete(id));
    inflight.set(id, task);
  }
  return task;
}

async function computeFull(uid: string, key: TitleKey, profile: TasteProfileDoc): Promise<MatchView> {
  const doc = await ensureTitle(key);
  if (!doc) throw notFound("We couldn’t find that title.");
  const titles = await titlesCol();
  const embedding = (await titles.findOne({ _id: key }, { projection: { embedding: 1 } }))?.embedding ?? null;

  const fp = featureProfile(profile);
  const features = featureScore(toFeatures(doc), fp);
  const vector = vectorPart(profile, embedding);
  const seen = await nearestSeen(profile, doc, embedding, 6);

  let judgement: Awaited<ReturnType<typeof judgeMatch>> | null = null;
  try {
    judgement = await judgeMatch({
      summary: profile.tasteSummary,
      dna: profile.tasteDNA,
      answers: profile.answers,
      neighbours: seen.map((s) => s.neighbour),
      target: judgeTarget(doc),
    });
  } catch (err) {
    console.warn("[match] judgement unavailable, using the estimate:", err instanceof Error ? err.message.slice(0, 160) : err);
  }

  const llm = judgement ? judgement.llmScore / 100 : null;
  const fallback = judgement ? null : explainMatch(toFeatures(doc), fp, termNames(doc));
  const becauseKeys = judgement?.becauseYouLiked.length
    ? judgement.becauseYouLiked
    : seen.filter((s) => s.neighbour.liked).slice(0, 2).map((s) => s.neighbour.id);
  const byKey = new Map(seen.map((s) => [s.neighbour.id, s.doc]));

  const result: MatchOk = {
    status: "ok",
    score: blendMatch({ vector, features: features.score, llm }),
    confidence: matchConfidence(judgement?.confidence ?? null, profile.signalCount),
    learning: profile.signalCount < LEARNING_BELOW,
    quick: !judgement,
    reasons: judgement?.reasons ?? fallback!.reasons,
    watchOut: judgement ? judgement.watchOut : fallback!.watchOut,
    becauseYouLiked: becauseKeys.flatMap((k) => {
      const d = byKey.get(k as TitleKey);
      return d ? [{ key: d._id, title: d.title, posterPath: d.posterPath, href: titleHref(d.mediaType, d.tmdbId, d.title) }] : [];
    }),
    profileVersion: profile.version,
    parts: { vector, features: round3(features.score), llm },
  };
  // Only a real judgement is worth keeping; an estimate is recomputed (and retried) next time.
  if (judgement) {
    const cache = await cacheCol();
    await cache.updateOne(
      { uid, key, profileVersion: profile.version, kind: "full" },
      { $set: { result, createdAt: new Date() } },
      { upsert: true },
    );
  }
  return result;
}

type SeenDoc = Pick<TitleDoc, "_id" | "title" | "year" | "genres" | "vibe" | "posterPath" | "mediaType" | "tmdbId">;

/**
 * RAG retrieval (brief §5.3.3): the titles the viewer has actually seen that
 * are closest to this one, with how they felt about each. Embedding cosine
 * when both sides have one; otherwise genre and theme overlap.
 */
export async function nearestSeen(profile: TasteProfileDoc, target: TitleDoc, embedding: number[] | null, n: number) {
  const pool = profile.signals
    .filter((s) => s.type !== "watchlisted" && s.key !== target._id)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 150);
  if (!pool.length) return [];
  const titles = await titlesCol();
  const keys = pool.map((s) => s.key);
  const [docs, dots] = await Promise.all([
    titles.find({ _id: { $in: keys } }, { projection: { title: 1, year: 1, genres: 1, vibe: 1, posterPath: 1, mediaType: 1, tmdbId: 1 } }).toArray() as Promise<SeenDoc[]>,
    embedding ? dotsWith(embedding, keys) : Promise.resolve(null),
  ]);
  const byKey = new Map(docs.map((d) => [d._id, d]));
  const targetTerms = [...(target.vibe?.themes ?? []), ...(target.vibe?.mood ?? [])];

  const ranked = pool
    .flatMap((s) => {
      const d = byKey.get(s.key);
      if (!d) return [];
      const vec = dots?.get(s.key) ?? null;
      const overlap = 0.6 * jaccard(target.genres, d.genres) + 0.4 * jaccard(targetTerms, [...(d.vibe?.themes ?? []), ...(d.vibe?.mood ?? [])]);
      return [{ signal: s, doc: d, vec, overlap }];
    })
    // Embedded neighbours first (cosine is the better measure), then the overlap-ranked rest.
    .sort((a, b) => (a.vec != null && b.vec != null ? b.vec - a.vec : a.vec != null ? -1 : b.vec != null ? 1 : b.overlap - a.overlap))
    .slice(0, n);

  // What they said about these titles: the "why" behind each rating.
  const reactions = await reactionsFor(profile.uid, ranked.map((r) => r.doc._id));

  return ranked.map(({ signal, doc }) => ({
    doc,
    signal,
    neighbour: {
      id: doc._id,
      title: doc.title,
      year: doc.year,
      genres: doc.genres,
      feeling: feelingOf(signal),
      liked: signal.weight > 0,
      vibe: doc.vibe?.summary ?? null,
      reactions: reactions.get(doc._id) ?? null,
    } satisfies JudgeNeighbour,
  }));
}

/** The viewer's reactions (what worked / what didn't / their own words) for these titles, as prompt lines. */
export async function reactionsFor(uid: string, keys: TitleKey[]): Promise<Map<TitleKey, string>> {
  if (!keys.length) return new Map();
  await connectDb();
  const items = await LibraryItem.find({ uid, key: { $in: keys } }, { key: 1, worked: 1, didnt: 1, note: 1 }).lean();
  const lines = items.flatMap((i) => {
    const line = describeReactions(i);
    return line ? [[i.key as TitleKey, line] as const] : [];
  });
  return new Map(lines);
}

function feelingOf(s: Signal): string {
  if (s.source === "favourite") return "one of their all-time favourites";
  if (s.source === "rating" && s.rating != null) {
    const word = s.rating >= 9 ? "loved it" : s.rating >= 7 ? "liked it" : s.rating >= 5 ? "thought it was okay" : "disliked it";
    return `rated it ${s.rating}/10 (${word})`;
  }
  if (s.source === "swipe") return s.weight > 0 ? "said they loved it" : "said it wasn’t for them";
  if (s.source === "feedback") return s.weight > 0 ? "hasn’t seen it, but thinks they might like it" : "hasn’t seen it, and agreed it isn’t for them";
  if (s.type === "dropped") return "dropped it partway through";
  return s.weight >= 0.4 ? "is watching it now" : "watched it, no rating";
}

function kindOf(category: Category, mediaType: MediaType): string {
  if (category === "anime") return mediaType === "movie" ? "anime film" : "anime series";
  if (category === "cartoon") return mediaType === "movie" ? "animated film" : "animated series";
  return mediaType === "movie" ? "film" : "series";
}

export function judgeTarget(d: TitleDoc): JudgeTarget {
  const names = (ps: { name: string }[], n: number) => ps.slice(0, n).map((p) => p.name).join(", ");
  const credits = [
    d.directors.length ? `Directed by ${names(d.directors, 2)}` : null,
    d.creators.length ? `Created by ${names(d.creators, 2)}` : null,
    d.topCast.length ? `Starring ${names(d.topCast, 4)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const r = d.ratings;
  const critics = [
    r.imdb ? `IMDb ${r.imdb}` : null,
    r.rottenTomatoes != null ? `Rotten Tomatoes ${r.rottenTomatoes}%` : null,
    r.metacritic != null ? `Metacritic ${r.metacritic}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: d._id,
    title: d.title,
    year: d.year,
    kind: kindOf(d.category, d.mediaType),
    genres: d.genres,
    runtime: d.mediaType === "movie" ? formatRuntime(d.runtime) : d.seasons ? `${d.seasons} season${d.seasons === 1 ? "" : "s"}` : null,
    credits: credits || null,
    overview: excerpt(d.overview ?? "", 600),
    vibe: d.vibe?.summary ?? null,
    themes: d.vibe?.themes ?? [],
    mood: d.vibe?.mood ?? [],
    critics: critics || null,
  };
}

/** Display names for the people/collection/franchise terms of a title. */
export function termNames(d: Pick<TitleDoc, "directors" | "creators" | "topCast" | "collection" | "franchises">): TermNames {
  const names: TermNames = new Map();
  for (const p of [...(d.directors ?? []), ...(d.creators ?? [])]) names.set(`d:${p.id}`, p.name);
  for (const p of (d.topCast ?? []).slice(0, 5)) names.set(`a:${p.id}`, p.name);
  if (d.collection) names.set(`c:${d.collection.id}`, d.collection.name);
  for (const f of d.franchises ?? []) if (FRANCHISE_NAME[f]) names.set(`f:${f}`, FRANCHISE_NAME[f]!);
  return names;
}

/**
 * Quick scores for lists (brief §5.7: no LLM per card). Where a full match is
 * already cached for this profile version, its score wins, so a title shows
 * the same number everywhere once you've opened it.
 */
export async function getQuickScores(uid: string, keys: TitleKey[]): Promise<Record<string, number>> {
  const profile = await getFreshProfile(uid);
  if (!hasTaste(profile)) return {};
  const wanted = [...new Set(keys)].slice(0, 80);
  const titles = await titlesCol();
  const projection = SCORING_PROJECTION;
  // The vector part is worked out in the database, so the embeddings themselves never travel.
  const [found, dots] = await Promise.all([
    titles.find({ _id: { $in: wanted } }, { projection }).toArray(),
    profile.tasteVector ? dotsWith(profile.tasteVector, wanted) : Promise.resolve(new Map<TitleKey, number>()),
  ]);
  let docs = found;
  const missing = wanted.filter((k) => !docs.some((d) => d._id === k)).slice(0, 24);
  if (missing.length) {
    // Titles we've never seen (e.g. fresh TMDB results): fetch details only, so they get a features-based score.
    await ensureTitles(missing, { enrich: false, colors: false, jikan: false });
    docs = docs.concat(await titles.find({ _id: { $in: missing } }, { projection }).toArray());
  }

  const fp = featureProfile(profile);
  const out: Record<string, number> = {};
  for (const d of docs) {
    out[d._id] = blendMatch({ vector: vectorPart(profile, null, dots.get(d._id)), features: featureScore(toFeatures(d), fp).score });
  }
  const cache = await cacheCol();
  const full = await cache
    .find({ uid, key: { $in: wanted }, profileVersion: profile.version, kind: "full" }, { projection: { key: 1, "result.score": 1 } })
    .toArray();
  for (const f of full) out[f.key] = f.result.score;
  return out;
}
