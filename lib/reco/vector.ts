/** Small, dependency-free vector maths (unit-tested). */

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

export function norm(a: ArrayLike<number>): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: ArrayLike<number>): number[] {
  const n = norm(a);
  const out = Array.from(a);
  if (n === 0) return out;
  for (let i = 0; i < out.length; i++) out[i]! /= n;
  return out;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const d = norm(a) * norm(b);
  return d === 0 ? 0 : dot(a, b) / d;
}

/** Σ wᵢ·vᵢ / Σ|wᵢ| — the weighted centroid of a set of vectors. */
export function weightedMean(vectors: ArrayLike<number>[], weights: number[], dim?: number): number[] {
  const size = dim ?? vectors[0]?.length ?? 0;
  const out = new Array<number>(size).fill(0);
  let total = 0;
  vectors.forEach((v, i) => {
    const w = weights[i] ?? 0;
    if (!w) return;
    total += Math.abs(w);
    for (let j = 0; j < size; j++) out[j]! += w * v[j]!;
  });
  if (total > 0) for (let j = 0; j < size; j++) out[j]! /= total;
  return out;
}

/** 101 values: the 0th…100th percentiles of a sample (sorted ascending). */
export function percentileTable(values: number[]): number[] {
  if (values.length === 0) return [];
  const s = [...values].sort((a, b) => a - b);
  return Array.from({ length: 101 }, (_, p) => {
    const pos = (p / 100) * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
  });
}

/** Where `x` falls in a percentile table, as 0–1 (linear between table points). */
export function percentileRank(x: number, table: number[]): number {
  if (table.length < 2) return 0.5;
  if (x <= table[0]!) return 0;
  if (x >= table[table.length - 1]!) return 1;
  let lo = 0;
  let hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const span = table[hi]! - table[lo]!;
  const frac = span === 0 ? 0 : (x - table[lo]!) / span;
  return (lo + frac) / (table.length - 1);
}
