import type { TitleDoc } from "@/lib/db/titles";
import type { TitleFeatures } from "@/lib/reco/affinity";

/** The fields scoring needs from `titles` (embedding included; ask for it only when you'll use it). */
export const FEATURE_PROJECTION = {
  title: 1,
  year: 1,
  genres: 1,
  keywords: 1,
  vibe: 1,
  directors: 1,
  creators: 1,
  topCast: 1,
  collection: 1,
  franchises: 1,
  originalLanguage: 1,
} as const;

/**
 * What scoring reads and no more, for bulk reads (Home takes 150 titles at a time): people as ids
 * only and the vibe without its prose. Cast lists were 45% of Home's bytes and the vibe summary
 * another 14% (.qa/tmp/home-bytes.ts); names are fetched only where a sentence needs them.
 */
export const SCORING_PROJECTION = {
  title: 1,
  year: 1,
  genres: 1,
  keywords: 1,
  "vibe.pace": 1,
  "vibe.tone": 1,
  "vibe.complexity": 1,
  "vibe.themes": 1,
  "vibe.mood": 1,
  "directors.id": 1,
  "creators.id": 1,
  "topCast.id": 1,
  collection: 1,
  franchises: 1,
  originalLanguage: 1,
} as const;

type FeatureSource = Pick<
  TitleDoc,
  "_id" | "title" | "year" | "genres" | "keywords" | "vibe" | "directors" | "creators" | "topCast" | "collection" | "franchises" | "originalLanguage"
>;

export function toFeatures(d: FeatureSource): TitleFeatures {
  return {
    key: d._id,
    title: d.title,
    year: d.year,
    genres: d.genres ?? [],
    keywords: d.keywords ?? [],
    themes: d.vibe?.themes ?? [],
    mood: d.vibe?.mood ?? [],
    people: [
      ...(d.directors ?? []).map((p) => `d:${p.id}`),
      ...(d.creators ?? []).map((p) => `d:${p.id}`),
      ...(d.topCast ?? []).slice(0, 5).map((p) => `a:${p.id}`),
    ],
    collection: d.collection ? `c:${d.collection.id}` : null,
    franchises: (d.franchises ?? []).map((f) => `f:${f}`),
    language: d.originalLanguage ?? "",
    vibe: d.vibe ? { pace: d.vibe.pace, tone: d.vibe.tone, complexity: d.vibe.complexity } : null,
  };
}
