import type { Affinity } from "@/lib/reco/affinity";

/**
 * How alike two people's tastes are, 0–100 (pure, unit-tested). Used for the match % between
 * friends, the invite reveal, and (later) Taste Twins. It only ever sees the "social" side of a
 * profile: the taste rebuilt without titles hidden from friends.
 *
 *   c = weighted mean of the parts that exist, each in [-1, 1]:
 *       0.5 · centred cosine of the taste vectors
 *       0.3 · Pearson correlation of their ratings on shared titles (only with ≥ 5 of them)
 *       0.2 · cosine of their genre affinities
 *   percent = c ≥ 0 ? 40 + 60c : 40 + 40c   (kept within 1–99, like every match on Reverie)
 *
 * Why centred: every title embedding shares a large common direction (the catalog mean has
 * length ≈ 0.8), so raw cosines between any two tastes sit at 0.80–0.98. Subtracting the catalog
 * mean leaves what's distinctive. Measured (.qa/tmp/similarity-calibrate.ts): fans of the same
 * genre built from different titles score 0.70–0.80, fans of different genres −0.13–0.24 with a
 * median of 0.08. The curve puts the first group near 85% and the second near 45%.
 */

export type SocialTaste = {
  /** Unit taste vector without hidden titles, or null when there's no vector yet. */
  vector: ArrayLike<number> | null;
  genres: Affinity[];
};

export const SIMILARITY_WEIGHTS = { vector: 0.5, ratings: 0.3, genres: 0.2 } as const;
/** Rating agreement says little below this many shared rated titles. */
export const MIN_SHARED_RATINGS = 5;

export type SimilarityParts = { vector: number | null; ratings: number | null; genres: number | null };

/** Cosine of a − mean and b − mean (plain cosine without a mean). Null for a zero vector. */
export function centeredCosine(a: ArrayLike<number>, b: ArrayLike<number>, mean: ArrayLike<number> | null): number | null {
  if (!a.length || a.length !== b.length || (mean && mean.length !== a.length)) return null;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]! - (mean ? mean[i]! : 0);
    const y = b[i]! - (mean ? mean[i]! : 0);
    ab += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa && bb ? clamp1(ab / Math.sqrt(aa * bb)) : null;
}

/** Cosine of two genre-affinity profiles over the union of their genres. Null when either is empty. */
export function genreCosine(a: Affinity[], b: Affinity[]): number | null {
  if (!a.length || !b.length) return null;
  const bv = new Map(b.map((x) => [x.term, x.value]));
  let ab = 0;
  for (const x of a) ab += x.value * (bv.get(x.term) ?? 0);
  const aa = a.reduce((s, x) => s + x.value * x.value, 0);
  const bb = b.reduce((s, x) => s + x.value * x.value, 0);
  return aa && bb ? clamp1(ab / Math.sqrt(aa * bb)) : null;
}

/** Pearson correlation of paired ratings; null with too few pairs or when either side never varies. */
export function ratingAgreement(pairs: [number, number][]): number | null {
  if (pairs.length < MIN_SHARED_RATINGS) return null;
  const n = pairs.length;
  const ma = pairs.reduce((s, p) => s + p[0], 0) / n;
  const mb = pairs.reduce((s, p) => s + p[1], 0) / n;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (const [x, y] of pairs) {
    ab += (x - ma) * (y - mb);
    aa += (x - ma) ** 2;
    bb += (y - mb) ** 2;
  }
  return aa && bb ? clamp1(ab / Math.sqrt(aa * bb)) : null;
}

/** The calibrated curve from c ∈ [−1, 1] to a percentage (see the header). */
export function similarityPercent(c: number): number {
  const p = c >= 0 ? 40 + 60 * c : 40 + 40 * c;
  return Math.round(Math.min(99, Math.max(1, p)));
}

/**
 * The centred cosine from dot products alone, for unit vectors a and b and the catalog mean μ:
 * (a−μ)·(b−μ) / (|a−μ||b−μ|) = (a·b − a·μ − b·μ + μ·μ) / √((1 − 2a·μ + μ·μ)(1 − 2b·μ + μ·μ)).
 * Lets the database work out the dots, so profiles' vectors never have to travel (Taste Twins).
 */
export function centredCosineFromDots(ab: number, aMu: number, bMu: number, muMu: number): number | null {
  const na = 1 - 2 * aMu + muMu;
  const nb = 1 - 2 * bMu + muMu;
  if (na <= 1e-12 || nb <= 1e-12) return null;
  return clamp1((ab - aMu - bMu + muMu) / Math.sqrt(na * nb));
}

/** The weighted mean of the parts that exist, as a percentage; null without a profile signal. */
export function scoreFromParts(parts: SimilarityParts): number | null {
  // Shared ratings alone aren't a taste: one of the profile signals has to be there.
  if (parts.vector == null && parts.genres == null) return null;
  let sum = 0;
  let weight = 0;
  for (const k of ["vector", "ratings", "genres"] as const) {
    const v = parts[k];
    if (v == null) continue;
    sum += SIMILARITY_WEIGHTS[k] * v;
    weight += SIMILARITY_WEIGHTS[k];
  }
  return similarityPercent(sum / weight);
}

export function tasteSimilarity(
  a: SocialTaste,
  b: SocialTaste,
  opts: { mean?: ArrayLike<number> | null; sharedRatings?: [number, number][] } = {},
): { score: number; parts: SimilarityParts } | null {
  const parts: SimilarityParts = {
    vector: a.vector && b.vector ? centeredCosine(a.vector, b.vector, opts.mean ?? null) : null,
    ratings: ratingAgreement(opts.sharedRatings ?? []),
    genres: genreCosine(a.genres, b.genres),
  };
  const score = scoreFromParts(parts);
  return score == null ? null : { score, parts };
}

function clamp1(x: number) {
  return Math.max(-1, Math.min(1, x));
}
