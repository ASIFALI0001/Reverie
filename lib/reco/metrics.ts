/** Evaluation metrics for the match engine (pure, unit-tested). */

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

/** Ranks with ties sharing their average rank (1-based). */
export function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]!.i] = avg;
    i = j + 1;
  }
  return out;
}

export function spearman(x: number[], y: number[]): number {
  return pearson(ranks(x), ranks(y));
}

/** NDCG@k with the true rating as (linear) gain, ranked by the prediction. */
export function ndcgAt(k: number, predicted: number[], truth: number[]): number {
  const dcg = (order: number[]) => order.slice(0, k).reduce((s, i, pos) => s + truth[i]! / Math.log2(pos + 2), 0);
  const idx = truth.map((_, i) => i);
  const byPred = [...idx].sort((a, b) => predicted[b]! - predicted[a]!);
  const ideal = [...idx].sort((a, b) => truth[b]! - truth[a]!);
  const best = dcg(ideal);
  return best === 0 ? 0 : dcg(byPred) / best;
}

export function meanSd(xs: number[]): { mean: number; sd: number } {
  if (!xs.length) return { mean: NaN, sd: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
  return { mean, sd };
}
