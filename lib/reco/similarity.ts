import type { TitleFeatures } from "@/lib/reco/affinity";

/**
 * "Is it like Jurassic World?" (brief §5.4.3): similarity of a candidate to the
 * source title, not to the viewer. Pure and unit-tested.
 */

export const SIMILARITY_WEIGHTS = { embedding: 0.45, themes: 0.2, vibe: 0.15, lineage: 0.1, genres: 0.1 } as const;
/** TMDB's own recommendation lists are a useful vote, but only a nudge. */
const REC_BONUS = 0.05;
const SIMILAR_BONUS = 0.03;

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function vibeSimilarity(a: TitleFeatures["vibe"], b: TitleFeatures["vibe"]): number | null {
  if (!a || !b) return null;
  return 1 - (Math.abs(a.pace - b.pace) + Math.abs(a.tone - b.tone) + Math.abs(a.complexity - b.complexity)) / 3;
}

/** Same director/creator, collection or franchise. Shared cast counts for less. */
export function lineage(a: TitleFeatures, b: TitleFeatures): number {
  if (a.collection && a.collection === b.collection) return 1;
  if (a.franchises.some((f) => b.franchises.includes(f))) return 0.8;
  const directors = (t: TitleFeatures) => t.people.filter((p) => p.startsWith("d:"));
  if (directors(a).some((d) => b.people.includes(d))) return 0.8;
  const cast = (t: TitleFeatures) => t.people.filter((p) => p.startsWith("a:"));
  const shared = cast(a).filter((c) => b.people.includes(c)).length;
  return Math.min(0.5, shared * 0.2);
}

export type SimilarityInput = {
  source: TitleFeatures;
  candidate: TitleFeatures;
  /** 0–1: the candidate's cosine as a percentile of the source's catalog distribution; null without embeddings. */
  embeddingPct: number | null;
  inRecs: boolean;
  inSimilar: boolean;
};

export function similarity({ source, candidate, embeddingPct, inRecs, inSimilar }: SimilarityInput): number {
  const terms = (t: TitleFeatures) => [...t.themes, ...t.mood, ...t.keywords.slice(0, 15)].map((s) => s.toLowerCase());
  const parts: [number, number | null][] = [
    [SIMILARITY_WEIGHTS.embedding, embeddingPct],
    // Theme/keyword overlap is sparse by nature; scale it so a real overlap counts.
    [SIMILARITY_WEIGHTS.themes, Math.min(1, jaccard(terms(source), terms(candidate)) * 3)],
    [SIMILARITY_WEIGHTS.vibe, vibeSimilarity(source.vibe, candidate.vibe)],
    [SIMILARITY_WEIGHTS.lineage, lineage(source, candidate)],
    [SIMILARITY_WEIGHTS.genres, jaccard(source.genres, candidate.genres)],
  ];
  let sum = 0;
  let weight = 0;
  for (const [w, v] of parts) {
    if (v == null) continue;
    sum += w * v;
    weight += w;
  }
  return (weight ? sum / weight : 0) + (inRecs ? REC_BONUS : 0) + (inSimilar ? SIMILAR_BONUS : 0);
}
