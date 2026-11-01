import { describe, expect, it } from "vitest";
import { FRIENDS_SEE_SCOPES, SHOWN_TO_FRIENDS, canSee, dnaForOthers, visibleScopes } from "@/lib/social/visibility";
import { centeredCosine, genreCosine, ratingAgreement, similarityPercent, tasteSimilarity, MIN_SHARED_RATINGS } from "@/lib/social/similarity";

describe("who sees what", () => {
  it("lets you see all of your own data, whatever your setting", () => {
    for (const setting of ["everything", "ratings", "nothing"] as const) {
      expect(visibleScopes("self", setting)).toEqual(["ratings", "library", "watchlist", "activity"]);
    }
  });

  it("shows strangers and pending requests nothing beyond the public card", () => {
    for (const relation of ["none", "request-sent", "request-received"] as const) {
      for (const setting of ["everything", "ratings", "nothing"] as const) expect(visibleScopes(relation, setting)).toEqual([]);
    }
  });

  it("shows friends exactly what the owner allows", () => {
    expect(visibleScopes("friends", "everything")).toEqual(["ratings", "library", "watchlist", "activity"]);
    expect(visibleScopes("friends", "ratings")).toEqual(["ratings"]);
    expect(visibleScopes("friends", "nothing")).toEqual([]);
    expect(canSee("friends", "ratings", "watchlist")).toBe(false);
    expect(canSee("friends", "ratings", "activity")).toBe(false);
    expect(canSee("friends", "everything", "watchlist")).toBe(true);
  });

  it("defaults to ratings only, and the levels nest", () => {
    expect(FRIENDS_SEE_SCOPES.nothing.every((s) => FRIENDS_SEE_SCOPES.ratings.includes(s))).toBe(true);
    expect(FRIENDS_SEE_SCOPES.ratings.every((s) => FRIENDS_SEE_SCOPES.everything.includes(s))).toBe(true);
  });

  it("filters hidden items in the query itself", () => {
    expect(SHOWN_TO_FRIENDS).toEqual({ hiddenFromFriends: { $ne: true } });
  });

  it("drops Taste DNA phrases that name a hidden title", () => {
    const dna = ["Loves slow-burn horror like Hereditary", "Drawn to big-hearted animation", "Can’t resist a heist"];
    expect(dnaForOthers(dna, ["Hereditary"])).toEqual(["Drawn to big-hearted animation", "Can’t resist a heist"]);
    expect(dnaForOthers(dna, ["HEREDITARY "])).toHaveLength(2);
    // Very short names would match by accident ("It", "Up"), so they're ignored.
    expect(dnaForOthers(dna, ["It", "Up"])).toEqual(dna);
    expect(dnaForOthers(dna, [])).toEqual(dna);
  });
});

describe("taste similarity", () => {
  const unit = (v: number[]) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };

  it("centres vectors on the catalog mean before comparing", () => {
    const mean = [1, 0, 0];
    // Raw cosine is high (both lean on the shared direction); centred, they point opposite ways.
    const a = unit([1, 0.2, 0]);
    const b = unit([1, -0.2, 0]);
    expect(centeredCosine(a, b, null)!).toBeGreaterThan(0.9);
    expect(centeredCosine(a, b, mean)!).toBeLessThan(-0.9);
    expect(centeredCosine([1, 0], [1, 0, 0], null)).toBeNull();
    expect(centeredCosine([1, 0], [1, 0], [1, 0])).toBeNull();
  });

  it("compares genre profiles over the union of genres", () => {
    const horror = [{ term: "Horror", value: 0.9, n: 9 }];
    const comedy = [{ term: "Comedy", value: 0.8, n: 5 }];
    expect(genreCosine(horror, horror)).toBeCloseTo(1);
    expect(genreCosine(horror, comedy)).toBe(0);
    expect(genreCosine(horror, [{ term: "Horror", value: -0.7, n: 4 }])).toBeCloseTo(-1);
    expect(genreCosine([], horror)).toBeNull();
  });

  it("only trusts rating agreement with enough shared titles", () => {
    const agree: [number, number][] = [
      [10, 9],
      [8, 8],
      [3, 2],
      [6, 7],
      [9, 10],
    ];
    expect(agree).toHaveLength(MIN_SHARED_RATINGS);
    expect(ratingAgreement(agree)!).toBeGreaterThan(0.9);
    expect(ratingAgreement(agree.map(([a, b]) => [a, 11 - b] as [number, number]))!).toBeLessThan(-0.9);
    expect(ratingAgreement(agree.slice(0, 4))).toBeNull();
    expect(ratingAgreement(agree.map(([a]) => [a, 7] as [number, number]))).toBeNull();
  });

  it("maps the combined score onto the calibrated curve", () => {
    expect(similarityPercent(1)).toBe(99);
    expect(similarityPercent(0.75)).toBe(85);
    expect(similarityPercent(0)).toBe(40);
    expect(similarityPercent(-1)).toBe(1);
    expect(similarityPercent(2)).toBe(99);
  });

  it("is symmetric, ranks closer tastes higher, and needs a profile signal", () => {
    const mean = [0.8, 0, 0, 0];
    const sciFi = { vector: unit([0.8, 0.5, 0.1, 0]), genres: [{ term: "Science Fiction", value: 0.9, n: 8 }] };
    const sciFi2 = { vector: unit([0.8, 0.45, 0.15, 0]), genres: [{ term: "Science Fiction", value: 0.8, n: 6 }] };
    const romance = { vector: unit([0.8, -0.1, 0, 0.5]), genres: [{ term: "Romance", value: 0.9, n: 7 }] };
    const close = tasteSimilarity(sciFi, sciFi2, { mean })!.score;
    const far = tasteSimilarity(sciFi, romance, { mean })!.score;
    expect(close).toBeGreaterThan(80);
    expect(far).toBeLessThan(45);
    expect(tasteSimilarity(sciFi2, sciFi, { mean })!.score).toBe(close);
    expect(tasteSimilarity({ vector: null, genres: [] }, sciFi, { mean })).toBeNull();
    // Without vectors, genres alone still give an answer.
    expect(tasteSimilarity({ vector: null, genres: sciFi.genres }, { vector: null, genres: sciFi2.genres })!.score).toBe(99);
  });
});
