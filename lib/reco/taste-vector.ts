import { normalize, weightedMean } from "@/lib/reco/vector";

/** How much the onboarding answers steer the vector: plenty at first, little once real signals pile up. */
export function answerShare(signalCount: number): number {
  if (signalCount < 5) return 0.4;
  if (signalCount < 15) return 0.25;
  return 0.15;
}

/**
 * Brief §5.2: the weighted mean of liked-title embeddings minus (half) the
 * disliked mean, blended with the embedding of the viewer's own answers.
 * Unit length; null when there's nothing to go on.
 */
export function tasteVectorFrom(
  items: { vector: ArrayLike<number>; weight: number }[],
  answer: ArrayLike<number> | null,
): number[] | null {
  const pos = items.filter((i) => i.weight > 0);
  const neg = items.filter((i) => i.weight < 0);

  let signal: number[] | null = null;
  if (pos.length) {
    const p = weightedMean(pos.map((i) => i.vector), pos.map((i) => i.weight));
    if (neg.length) {
      const n = weightedMean(neg.map((i) => i.vector), neg.map((i) => -i.weight));
      for (let j = 0; j < p.length; j++) p[j]! -= 0.5 * n[j]!;
    }
    signal = normalize(p);
  }

  if (!answer?.length) return signal;
  if (!signal) return normalize(answer);
  const a = answerShare(pos.length + neg.length);
  return normalize(signal.map((v, j) => (1 - a) * v + a * answer[j]!));
}
