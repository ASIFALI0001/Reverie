import { describe, expect, it } from "vitest";
import { centeredCosine, centredCosineFromDots, scoreFromParts, tasteSimilarity } from "@/lib/social/similarity";
import { applyOutsideNudges, codenames, sharedGenres, TWIN_RULES, twinComponent, twinHues } from "@/lib/twins/math";
import { dot, normalize } from "@/lib/reco/vector";

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const unit = (n = 32) => normalize(Array.from({ length: n }, rand));

describe("centred cosine from dot products", () => {
  it("matches the centred cosine of the vectors themselves", () => {
    // A mean with a big common direction, like the catalog's.
    const mean = unit().map((x) => x * 0.8);
    const muMu = dot(mean, mean);
    for (let i = 0; i < 25; i++) {
      const a = unit();
      const b = unit();
      const fromDots = centredCosineFromDots(dot(a, b), dot(a, mean), dot(b, mean), muMu)!;
      expect(fromDots).toBeCloseTo(centeredCosine(a, b, mean)!, 10);
    }
  });

  it("scores parts exactly as the full similarity does", () => {
    const a = { vector: unit(), genres: [{ term: "Drama", value: 0.6, n: 4 }] };
    const b = { vector: unit(), genres: [{ term: "Drama", value: 0.3, n: 2 }] };
    const full = tasteSimilarity(a, b, { sharedRatings: [[8, 7], [9, 9], [4, 5], [6, 6], [10, 9]] })!;
    expect(scoreFromParts(full.parts)).toBe(full.score);
    expect(scoreFromParts({ vector: null, ratings: 0.9, genres: null })).toBeNull();
  });
});

describe("the twin nudge", () => {
  it("needs at least two twins who rated the title", () => {
    expect(twinComponent([{ score: 90, rating: 9 }])).toBeNull();
    expect(twinComponent([])).toBeNull();
    const c = twinComponent([
      { score: 90, rating: 10 },
      { score: 70, rating: 6 },
    ])!;
    // Weights (90−40)/60 and (70−40)/60: (0.833·1.0 + 0.5·0.6) / 1.333 = 0.85.
    expect(c.raters).toBe(2);
    expect(c.t).toBeCloseTo(0.85, 3);
  });

  it("ignores a 'twin' with no real taste relation", () => {
    expect(twinComponent([{ score: 90, rating: 9 }, { score: 40, rating: 2 }])).toBeNull();
  });

  it("is 15% on its own, and shares the 20% outside cap with friends (friends first)", () => {
    const twins = [
      { score: 90, rating: 10 },
      { score: 85, rating: 10 },
    ];
    const alone = applyOutsideNudges(60, [], twins);
    expect(alone.twinWeight).toBe(TWIN_RULES.weight);
    expect(alone.score).toBe(Math.round(0.85 * 60 + 0.15 * 100));
    // Two close friends at full weight (10%) leave the twins 10%.
    const friends = [
      { tasteMatch: 95, rating: 2 },
      { tasteMatch: 95, rating: 2 },
    ];
    const both = applyOutsideNudges(60, friends, twins);
    expect(both.friendWeight).toBe(0.1);
    expect(both.twinWeight).toBe(0.1);
    expect(both.score).toBe(Math.round(0.8 * 60 + 0.1 * 20 + 0.1 * 100));
    expect(applyOutsideNudges(60, [], [])).toEqual({ score: 60, friendWeight: 0, twinWeight: 0 });
    expect(applyOutsideNudges(99, [], twins).score).toBeLessThanOrEqual(99);
  });
});

describe("codenames and avatars", () => {
  const twins = Array.from({ length: 30 }, (_, i) => `twin-uid-${i}`);
  it("are stable, letter-and-digit, and never repeat within one list", () => {
    const a = codenames("viewer-1", twins);
    expect(codenames("viewer-1", twins)).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
    for (const c of a) expect(c).toMatch(/^[A-HJ-NP-Z]\d$/);
  });

  it("differ between viewers, so two people can't compare notes on who a twin is", () => {
    const one = codenames("viewer-1", twins);
    const two = codenames("viewer-2", twins);
    expect(one.filter((c, i) => c === two[i]).length).toBeLessThan(5);
  });

  it("give each pairing its own two hues", () => {
    expect(twinHues("v", "t")).toEqual(twinHues("v", "t"));
    const [a, b] = twinHues("v", "t");
    expect(a).not.toBe(b);
  });
});

describe("shared genres", () => {
  const g = (term: string, value: number) => ({ term, value });
  it("ranks the genres you both lean toward by the weaker of the two", () => {
    const you = [g("Science Fiction", 0.9), g("Thriller", 0.7), g("Drama", 0.4), g("Horror", 0.8), g("Romance", -0.5)];
    const them = [g("Science Fiction", 0.5), g("Thriller", 0.8), g("Drama", 0.6), g("Horror", 0.05), g("Romance", 0.9)];
    // Thriller 0.7, Science Fiction 0.5, Drama 0.4; Horror and Romance are only one side's.
    expect(sharedGenres(you, them)).toEqual(["Thriller", "Science Fiction", "Drama"]);
  });
  it("keeps to three and is empty when nothing is shared", () => {
    const many = ["A", "B", "C", "D", "E"].map((t) => g(t, 0.6));
    expect(sharedGenres(many, many)).toHaveLength(3);
    expect(sharedGenres([g("Comedy", 0.9)], [g("Horror", 0.9)])).toEqual([]);
  });
});
