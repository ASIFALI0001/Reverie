import { describe, expect, it } from "vitest";
import { applyFriendBoost, friendComponent, similarityWeight, FRIEND_MAX_WEIGHT } from "@/lib/social/friend-boost";
import { combinedMatch, lowestMatch, rankForGroup } from "@/lib/social/combined-match";
import { compareRadars } from "@/lib/social/compare-taste";
import { fallbackPickReason } from "@/lib/ai/group-pick";
import type { RadarPoint } from "@/lib/taste/types";

describe("friend-boosted match", () => {
  it("weighs a friend by how far above 'no relation' (40%) their taste match is", () => {
    expect(similarityWeight(40)).toBe(0);
    expect(similarityWeight(30)).toBe(0);
    expect(similarityWeight(70)).toBeCloseTo(0.5);
    expect(similarityWeight(100)).toBe(1);
  });

  it("averages ratings by similarity and grows its weight with more (and closer) friends", () => {
    const one = friendComponent([{ tasteMatch: 88, rating: 9 }])!;
    expect(one.f).toBeCloseTo(0.9);
    expect(one.w).toBeCloseTo(FRIEND_MAX_WEIGHT * (0.8 / 1.5));
    const two = friendComponent([
      { tasteMatch: 88, rating: 9 },
      { tasteMatch: 94, rating: 7 },
    ])!;
    expect(two.w).toBe(FRIEND_MAX_WEIGHT);
    // The closer friend's rating counts a little more.
    expect(two.f).toBeGreaterThan(0.79);
    expect(two.f).toBeLessThan(0.8);
  });

  it("ignores unrelated tastes and impossible ratings", () => {
    expect(friendComponent([{ tasteMatch: 35, rating: 10 }])).toBeNull();
    expect(friendComponent([{ tasteMatch: 90, rating: 0 }, { tasteMatch: 90, rating: 11 }])).toBeNull();
    expect(friendComponent([])).toBeNull();
  });

  it("moves the match by at most 10% of the way toward the friends' verdict", () => {
    const close = [
      { tasteMatch: 95, rating: 10 },
      { tasteMatch: 92, rating: 10 },
    ];
    expect(applyFriendBoost(60, close)).toEqual({ score: 64, weight: 0.1 });
    expect(applyFriendBoost(60, [{ tasteMatch: 95, rating: 2 }, { tasteMatch: 92, rating: 2 }]).score).toBe(56);
    expect(applyFriendBoost(60, [])).toEqual({ score: 60, weight: 0 });
    // A tighter cap (when Taste Twins take their share) is respected.
    expect(applyFriendBoost(60, close, 0.05).weight).toBe(0.05);
    // Scores stay within 1–99 like every match.
    expect(applyFriendBoost(99, close).score).toBeLessThanOrEqual(99);
  });
});

describe("combined match for shared lists", () => {
  it("is the mean when nobody is below 50%", () => {
    expect(combinedMatch([80, 70, 90])).toBe(80);
  });

  it("pulls hard for anyone below 50%", () => {
    // mean 70, one member at 30 → −0.6·20 = −12
    expect(combinedMatch([90, 90, 30])).toBe(58);
    // "Good for everyone" beats "great for two, awful for one".
    expect(combinedMatch([72, 70, 68])!).toBeGreaterThan(combinedMatch([95, 95, 30])!);
  });

  it("leaves out members without a match and clamps to 0–100", () => {
    expect(combinedMatch([80, null, undefined])).toBe(80);
    expect(combinedMatch([null])).toBeNull();
    expect(combinedMatch([5, 5])).toBe(0);
    expect(lowestMatch([80, null, 61])).toBe(61);
  });

  it("ranks by combined match, then by the highest lowest match, then by order added", () => {
    const ranked = rankForGroup([
      { id: "a", matches: [60, 60] },
      { id: "b", matches: [90, 30] },
      { id: "c", matches: [null, null] },
      { id: "d", matches: [70, 50] },
      { id: "e", matches: [80, 40] },
    ]);
    // a: 60 · b: 60 − 12 = 48 · d: 60 · e: 60 − 6 = 54 · c: none
    expect(ranked.map((r) => r.id)).toEqual(["a", "d", "e", "b", "c"]);
    expect(ranked[0]).toMatchObject({ combined: 60, lowest: 60 });
  });
});

describe("taste comparison", () => {
  const radar = (values: Record<string, number>, evidence = 3): RadarPoint[] =>
    ["Action", "Comedy", "Drama", "Romance", "Horror", "Thriller", "Sci-fi", "Family"].map((axis) => ({
      axis,
      value: values[axis] ?? 0.5,
      evidence: axis in values ? evidence : 0,
    }));

  it("finds shared loves and shared avoidances", () => {
    const { agree } = compareRadars(radar({ "Sci-fi": 0.85, Horror: 0.3 }), radar({ "Sci-fi": 0.7, Horror: 0.25 }), "Ben");
    expect(agree.map((a) => a.line)).toEqual(["You both love sci-fi", "Neither of you goes near horror"]);
  });

  it("phrases clashes from both sides", () => {
    const { clash } = compareRadars(radar({ Horror: 0.8, Romance: 0.38 }), radar({ Horror: 0.2, Romance: 0.75 }), "Ben");
    expect(clash.map((c) => c.line)).toEqual(["You love horror, Ben avoids it", "Ben loves romance, you can take it or leave it"]);
  });

  it("never reads silence as agreement", () => {
    const { agree, clash } = compareRadars(radar({}), radar({}), "Ben");
    expect(agree).toEqual([]);
    expect(clash).toEqual([]);
  });
});

describe("group pick fallback reason", () => {
  const base = { title: "Arrival", year: 2016, genres: ["Science Fiction"], vibe: null };
  it("says when there's no compromise to make", () => {
    expect(fallbackPickReason({ ...base, members: [{ name: "Ana", match: 88, leans: [] }, { name: "Ben", match: 74, leans: [] }] })).toBe(
      "Everyone’s at 74% or more for Arrival: no compromise needed tonight.",
    );
  });
  it("names the compromise otherwise", () => {
    expect(fallbackPickReason({ ...base, members: [{ name: "Ana", match: 88, leans: [] }, { name: "Ben", match: 55, leans: [] }] })).toBe(
      "The best compromise: Ana is at 88%, and even Ben sits at 55%.",
    );
  });
});
