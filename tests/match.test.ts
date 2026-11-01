import { describe, expect, it } from "vitest";
import { featureProfile, featureScore, vibeFit, FEATURE_WEIGHTS, type FeatureProfile } from "@/lib/reco/features";
import { blendMatch, matchConfidence, MATCH_WEIGHTS, QUICK_WEIGHTS } from "@/lib/reco/match-math";
import { jaccard, lineage, similarity, vibeSimilarity } from "@/lib/reco/similarity";
import { explainMatch, explainSimilar } from "@/lib/reco/explain";
import type { Affinity, TitleFeatures } from "@/lib/reco/affinity";
import type { TitleKey } from "@/lib/catalog/types";

const aff = (term: string, value: number, n = 3): Affinity => ({ term, value, n });

function title(over: Partial<TitleFeatures> = {}): TitleFeatures {
  return {
    key: "movie:1" as TitleKey,
    title: "T",
    year: 2015,
    genres: [],
    keywords: [],
    themes: [],
    mood: [],
    people: [],
    collection: null,
    franchises: [],
    language: "en",
    vibe: null,
    ...over,
  };
}

function profile(over: Partial<Parameters<typeof featureProfile>[0]> = {}): FeatureProfile {
  return featureProfile({
    genreAffinity: [],
    keywordAffinity: [],
    peopleAffinity: [],
    collectionAffinity: [],
    languageAffinity: [],
    vibePreference: null,
    era: { answer: null, meanYear: null },
    answers: null,
    ...over,
  });
}

describe("feature score", () => {
  it("is neutral with no evidence at all", () => {
    const b = featureScore(title({ genres: ["Drama"] }), profile());
    expect(b.score).toBe(0.5);
    expect(b.genre).toBeNull();
  });

  it("rewards loved genres and penalises disliked ones", () => {
    const p = profile({ genreAffinity: [aff("Science Fiction", 0.8), aff("Romance", -0.7)] });
    const scifi = featureScore(title({ genres: ["Science Fiction"] }), p);
    const romance = featureScore(title({ genres: ["Romance"] }), p);
    expect(scifi.genre).toBeCloseTo(0.9);
    expect(romance.genre).toBeCloseTo(0.15);
    expect(scifi.score).toBeGreaterThan(romance.score);
  });

  it("weighs genres by evidence", () => {
    const p = profile({ genreAffinity: [aff("Action", 0.1, 9), aff("Science Fiction", 0.9, 1)] });
    const b = featureScore(title({ genres: ["Action", "Science Fiction"] }), p);
    expect(b.genre).toBeCloseTo(((0.1 * 9 + 0.9) / 10 + 1) / 2);
  });

  it("lets one loved director lift, and one hated franchise sink, a title", () => {
    const p = profile({ peopleAffinity: [aff("d:1", 0.85)], collectionAffinity: [aff("f:x", -0.6)] });
    expect(featureScore(title({ people: ["d:1"] }), p).people).toBeCloseTo(0.925);
    expect(featureScore(title({ people: ["d:1"], franchises: ["f:x"] }), p).people).toBeCloseTo((0.85 - 0.6 + 1) / 2);
  });

  it("fits vibe, damped when the preference is mild", () => {
    const strong = { pace: 0.1, tone: 0.9, complexity: 0.9 };
    // A perfect fit, damped slightly because the preference (0.4 from neutral on each axis) is strong but not maximal.
    expect(vibeFit(strong, strong)).toBeCloseTo(0.935);
    expect(vibeFit({ pace: 0.9, tone: 0.1, complexity: 0.1 }, strong)).toBeLessThan(0.1);
    const mild = { pace: 0.5, tone: 0.5, complexity: 0.5 };
    expect(vibeFit(mild, mild)).toBeCloseTo(0.675);
    expect(vibeFit(null, strong)).toBeNull();
  });

  it("handles language and era", () => {
    const p = profile({ era: { answer: 1, meanYear: null }, answers: { subtitles: false, languages: ["en"] } });
    const classic = featureScore(title({ year: 1960 }), p, 2026);
    const recent = featureScore(title({ year: 2025 }), p, 2026);
    expect(classic.langEra).toBeGreaterThan(recent.langEra!);
    const foreign = featureScore(title({ language: "ko", year: null }), p, 2026);
    expect(foreign.langEra).toBe(0.25);
  });

  it("renormalises over the components it has", () => {
    const p = profile({ genreAffinity: [aff("Drama", 1, 50)] });
    const b = featureScore(title({ genres: ["Drama"] }), p);
    expect(b.score).toBeCloseTo(b.genre!);
    expect(Object.values(FEATURE_WEIGHTS).reduce((a, x) => a + x, 0)).toBeCloseTo(1);
  });
});

describe("match blend", () => {
  it("uses the brief's weights", () => {
    expect(MATCH_WEIGHTS.vector + MATCH_WEIGHTS.features + MATCH_WEIGHTS.llm).toBeCloseTo(1);
    expect(QUICK_WEIGHTS.vector + QUICK_WEIGHTS.features).toBeCloseTo(1);
    expect(blendMatch({ vector: 0.9, features: 0.6, llm: 0.8 })).toBe(Math.round((0.35 * 0.9 + 0.25 * 0.6 + 0.4 * 0.8) * 100));
    expect(blendMatch({ vector: 0.9, features: 0.6 })).toBe(Math.round((0.58 * 0.9 + 0.42 * 0.6) * 100));
  });
  it("renormalises when the vector score is missing", () => {
    expect(blendMatch({ vector: null, features: 0.6, llm: 0.8 })).toBe(Math.round(((0.25 * 0.6 + 0.4 * 0.8) / 0.65) * 100));
    expect(blendMatch({ vector: null, features: 0.7 })).toBe(70);
  });
  it("clamps to 1–99", () => {
    expect(blendMatch({ vector: 1, features: 1, llm: 1 })).toBe(99);
    expect(blendMatch({ vector: 0, features: 0, llm: 0 })).toBe(1);
  });
  it("caps confidence by evidence", () => {
    expect(matchConfidence(0.9, 3)).toBeCloseTo(0.2);
    expect(matchConfidence(0.7, 40)).toBeCloseTo(0.7);
    expect(matchConfidence(null, 30)).toBeCloseTo(0.6);
  });
});

describe("similarity", () => {
  const src = title({
    genres: ["Adventure", "Science Fiction"],
    themes: ["survival", "hubris"],
    mood: ["tense"],
    people: ["d:7", "a:1"],
    collection: "c:5",
    vibe: { pace: 0.7, tone: 0.5, complexity: 0.3 },
  });
  it("jaccard and vibe similarity behave", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(jaccard([], [])).toBe(0);
    expect(vibeSimilarity(src.vibe, src.vibe)).toBe(1);
    expect(vibeSimilarity(null, src.vibe)).toBeNull();
  });
  it("ranks lineage: collection > director/franchise > shared cast", () => {
    expect(lineage(src, title({ collection: "c:5" }))).toBe(1);
    expect(lineage(src, title({ people: ["d:7"] }))).toBe(0.8);
    expect(lineage(src, title({ people: ["a:1"] }))).toBeCloseTo(0.2);
    expect(lineage(src, title())).toBe(0);
  });
  it("prefers a close relative over a genre lookalike", () => {
    const sequel = title({ genres: ["Adventure", "Science Fiction"], themes: ["survival", "hubris"], collection: "c:5", vibe: src.vibe });
    const lookalike = title({ genres: ["Adventure", "Science Fiction"], themes: ["romance"], vibe: { pace: 0.2, tone: 0.9, complexity: 0.9 } });
    const a = similarity({ source: src, candidate: sequel, embeddingPct: 0.95, inRecs: true, inSimilar: false });
    const b = similarity({ source: src, candidate: lookalike, embeddingPct: 0.6, inRecs: false, inSimilar: false });
    expect(a).toBeGreaterThan(b);
    expect(similarity({ source: src, candidate: lookalike, embeddingPct: null, inRecs: false, inSimilar: false })).toBeGreaterThan(0);
  });
});

describe("explanations without the model", () => {
  const names = new Map([
    ["d:7", "Steven Spielberg"],
    ["c:5", "Jurassic Park Collection"],
  ]);
  it("grounds reasons in the strongest positive evidence and flags the worst mismatch", () => {
    const p = profile({
      genreAffinity: [aff("Science Fiction", 0.8), aff("Horror", -0.6)],
      peopleAffinity: [aff("d:7", 0.7)],
      keywordAffinity: [aff("survival", 0.6)],
    });
    const { reasons, watchOut } = explainMatch(
      title({ genres: ["Science Fiction", "Horror"], people: ["d:7"], themes: ["survival"] }),
      p,
      names,
    );
    expect(reasons[0]).toContain("sci-fi");
    expect(reasons.join(" ")).toContain("Steven Spielberg");
    expect(reasons.join(" ")).toContain("survival");
    expect(watchOut).toContain("horror");
  });
  it("always says something, and explains similarity by lineage first", () => {
    expect(explainMatch(title(), profile(), names).reasons).toHaveLength(1);
    expect(explainSimilar(title({ collection: "c:5" }), title({ collection: "c:5" }), names)).toContain("Jurassic Park");
    expect(explainSimilar(title({ genres: ["Drama"] }), title({ genres: ["Drama"] }), names)).toBe("Same drama territory");
  });
});

describe("evaluation metrics", () => {
  it("pearson / spearman agree on monotone data and handle ties", async () => {
    const { pearson, spearman, ranks } = await import("@/lib/reco/metrics");
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])).toBeCloseTo(1);
  });
  it("ndcg is 1 for a perfect order and lower for a reversed one", async () => {
    const { ndcgAt } = await import("@/lib/reco/metrics");
    const truth = [9, 7, 5, 3, 1];
    expect(ndcgAt(3, [5, 4, 3, 2, 1], truth)).toBeCloseTo(1);
    expect(ndcgAt(3, [1, 2, 3, 4, 5], truth)).toBeLessThan(0.6);
  });
});

describe("match colour as hex", () => {
  it("runs from daylight steel to tungsten without passing through green", async () => {
    const { matchColorHex } = await import("@/lib/match-color");
    const { hexToOklch } = await import("@/lib/color/oklch");
    const low = hexToOklch(matchColorHex(10));
    const high = hexToOklch(matchColorHex(98));
    expect(matchColorHex(98)).toBe("#e8a23a");
    expect(low.h).toBeGreaterThan(200); // blue-ish
    expect(high.h).toBeLessThan(90); // amber
    const mid = hexToOklch(matchColorHex(62));
    expect(mid.c).toBeLessThan(Math.max(low.c, high.c)); // the midpoint is near-neutral light, not saturated green
  });
});

describe("quick scores from a taste-vector search", () => {
  it("score the same from the search's similarity as from the embedding it saves fetching", async () => {
    const { quickParts } = await import("@/lib/reco/match-engine");
    const { dot, normalize, percentileTable } = await import("@/lib/reco/vector");
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const vec = () => normalize(Array.from({ length: 64 }, rand));
    const tasteVector = vec();
    const profile = {
      tasteVector,
      vectorPercentiles: percentileTable(Array.from({ length: 200 }, () => dot(tasteVector, vec()))),
      genreAffinity: [aff("drama", 0.6)],
      keywordAffinity: [],
      peopleAffinity: [],
      collectionAffinity: [],
      languageAffinity: [],
      vibePreference: null,
      era: { answer: null, meanYear: null },
      answers: null,
    } as unknown as Parameters<typeof quickParts>[0];
    for (let i = 0; i < 20; i++) {
      const embedding = vec();
      const doc = { _id: `movie:${i}` as TitleKey, title: "T", year: 2015, genres: ["drama"], keywords: [], vibe: null, directors: [], creators: [], topCast: [], collection: null, franchises: [], originalLanguage: "en" };
      // Atlas reports cosine as (1 + cos) / 2 in float32; 2·score − 1 lands within ~2e-7 of the dot product.
      const fromSearch = quickParts(profile, { ...doc, tasteDot: dot(tasteVector, embedding) + 1.5e-7 });
      expect(fromSearch).toEqual(quickParts(profile, { ...doc, embedding }));
    }
    // Without either, there's no vector part (features only), as before.
    expect(quickParts(profile, { _id: "movie:x" as TitleKey, title: "T", year: 2015, genres: [], keywords: [], vibe: null, directors: [], creators: [], topCast: [], collection: null, franchises: [], originalLanguage: "en" }).vector).toBeNull();
  });
});
