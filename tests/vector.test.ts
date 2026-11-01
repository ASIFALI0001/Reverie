import { describe, expect, it } from "vitest";
import { cosine, normalize, percentileRank, percentileTable, weightedMean } from "@/lib/reco/vector";
import { longQuota, retryDelayMs } from "@/lib/ai/gemini";

describe("vector maths", () => {
  it("normalizes to unit length (and leaves the zero vector alone)", () => {
    const v = normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
  it("cosine: identical = 1, orthogonal = 0, opposite = -1", () => {
    expect(cosine([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
  it("weighted mean pulls toward heavier vectors", () => {
    const m = weightedMean([[1, 0], [0, 1]], [3, 1]);
    expect(m[0]).toBeCloseTo(0.75);
    expect(m[1]).toBeCloseTo(0.25);
  });
  it("percentile table + rank spread a skewed distribution evenly", () => {
    const sample = Array.from({ length: 1000 }, (_, i) => 0.5 + 0.2 * (i / 999) ** 3); // bunched near 0.5
    const table = percentileTable(sample);
    expect(table).toHaveLength(101);
    expect(percentileRank(table[50]!, table)).toBeCloseTo(0.5, 2);
    expect(percentileRank(0.4, table)).toBe(0);
    expect(percentileRank(0.9, table)).toBe(1);
    // Monotonic.
    let prev = -1;
    for (let x = 0.5; x <= 0.7; x += 0.01) {
      const r = percentileRank(x, table);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});


describe("Gemini retry hints", () => {
  it("reads RetryInfo delays from 429 errors", () => {
    expect(retryDelayMs(new Error('{"error":{"code":429,"details":[{"retryDelay":"38s"}]}}'))).toBe(38_000);
    expect(retryDelayMs(new Error("Please retry in 7.5s."))).toBe(7_500);
    expect(retryDelayMs(new Error("boom"))).toBeNull();
  });
});

describe("Gemini daily-quota detection", () => {
  it("treats per-day quota ids and hour-long delays as non-retryable", () => {
    const daily = new Error('{"quotaId":"EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier","retryDelay":"59662s"}');
    expect(longQuota(daily)?.quotaId).toContain("PerDay");
    expect(longQuota(new Error('{"retryDelay":"7200s"}'))?.retryAfterMs).toBe(7_200_000);
  });
  it("leaves per-minute limits retryable", () => {
    expect(longQuota(new Error('{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel","retryDelay":"38s"}'))).toBeNull();
  });
});
