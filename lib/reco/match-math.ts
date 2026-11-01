/** Blending the match components (brief §5.3.5), pure and unit-tested. */

/** Full match: vector · features · Gemini's judgement. */
export const MATCH_WEIGHTS = { vector: 0.35, features: 0.25, llm: 0.4 } as const;
/** Quick estimate for lists (and the fallback when Gemini is unavailable): no LLM. */
export const QUICK_WEIGHTS = { vector: 0.58, features: 0.42 } as const;
/** Below this many signals the UI says "Getting to know you". */
export const LEARNING_BELOW = 5;

export type Parts = {
  /** 0–1: the title's percentile in the viewer's taste-vector distribution. */
  vector: number | null;
  /** 0–1: feature fit. */
  features: number;
  /** 0–1: Gemini's llmScore / 100. */
  llm?: number | null;
};

/** 1–99. Missing parts drop out and the rest are renormalised. */
export function blendMatch({ vector, features, llm = null }: Parts): number {
  const entries: [number, number][] =
    llm != null
      ? [
          [MATCH_WEIGHTS.vector, vector ?? NaN],
          [MATCH_WEIGHTS.features, features],
          [MATCH_WEIGHTS.llm, llm],
        ]
      : [
          [QUICK_WEIGHTS.vector, vector ?? NaN],
          [QUICK_WEIGHTS.features, features],
        ];
  let sum = 0;
  let weight = 0;
  for (const [w, v] of entries) {
    if (Number.isNaN(v)) continue;
    sum += w * v;
    weight += w;
  }
  const score = weight ? (sum / weight) * 100 : 50;
  return Math.round(Math.min(99, Math.max(1, score)));
}

/** Gemini's own confidence, capped by how much we actually know (15 signals = full confidence). */
export function matchConfidence(llmConfidence: number | null, signalCount: number): number {
  const evidence = Math.min(1, signalCount / 15);
  const llm = llmConfidence ?? 0.6;
  return Math.round(Math.min(llm, evidence) * 100) / 100;
}
