import { describe, expect, it } from "vitest";
import { MOOD_PRESETS, moodFit, moodScore, pickVaried, presetById, timeConstraints, withCompany, type MoodTarget } from "@/lib/mood/target";

const target = (id: string): MoodTarget => ({ ...presetById(id)!.target, formats: [], runtimeMax: null });

describe("mood presets", () => {
  it("covers the ten tiles from the brief, each a complete target on 0–1 scales", () => {
    expect(MOOD_PRESETS.map((p) => p.label)).toEqual([
      "Light & fun",
      "Can’t sleep",
      "Need a good cry",
      "Edge of my seat",
      "Make me think",
      "Comfort rewatch",
      "Feel inspired",
      "Scare me",
      "Romantic",
      "Background while eating",
    ]);
    for (const p of MOOD_PRESETS) {
      for (const v of Object.values(p.target.targetVibe)) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(p.target.targetVibe)) expect(v).toBeLessThanOrEqual(1);
      expect(p.target.query.length).toBeGreaterThan(10);
    }
    expect(target("comfort-rewatch").allowRewatch).toBe(true);
    expect(presetById("nope")).toBeNull();
  });
});

describe("time and company", () => {
  it("turns time into format and length limits", () => {
    expect(timeConstraints("short")).toEqual({ mediaType: "tv", runtimeMin: null, runtimeMax: 35 });
    expect(timeConstraints("film")).toEqual({ mediaType: "movie", runtimeMin: 70, runtimeMax: 115 });
    expect(timeConstraints("long")).toMatchObject({ mediaType: "movie", runtimeMin: 100 });
    expect(timeConstraints("binge")).toMatchObject({ mediaType: "tv" });
  });

  it("softens the target for family, and lifts the pace for friends", () => {
    const scary = target("scare-me");
    const family = withCompany(scary, "family");
    expect(family.targetVibe.tone).toBe(0.5);
    expect(family.themesAvoid).toEqual(expect.arrayContaining(["violence", "gore"]));
    expect(family.genres).toEqual(expect.arrayContaining(["Family", "Animation"]));
    expect(withCompany(scary, "friends").targetVibe.pace).toBeCloseTo(0.72);
    expect(withCompany(scary, "alone")).toBe(scary);
  });
});

describe("mood fit", () => {
  const cry = target("good-cry");

  it("rewards a close vibe and the moods it asks for", () => {
    const tearjerker = { vibe: { pace: 0.3, tone: 0.75, complexity: 0.5 }, moods: ["heartbreaking", "tender"], themes: ["grief", "family"], genres: ["Drama"] };
    const romp = { vibe: { pace: 0.85, tone: 0.1, complexity: 0.2 }, moods: ["funny", "zany"], themes: ["heist"], genres: ["Comedy"] };
    expect(moodFit(tearjerker, cry)).toBeGreaterThan(0.9);
    expect(moodFit(romp, cry)).toBeLessThan(0.4);
  });

  it("matches words loosely, and treats a missing vibe as neutral", () => {
    expect(moodFit({ vibe: null, moods: ["heartbreak"], themes: [], genres: [] }, cry)).toBeGreaterThan(moodFit({ vibe: null, moods: [], themes: [], genres: [] }, cry));
  });

  it("marks down what the mood avoids", () => {
    const gentle = target("cant-sleep");
    const calm = { vibe: { pace: 0.3, tone: 0.3, complexity: 0.3 }, moods: ["calm"], themes: ["nature"], genres: ["Documentary"] };
    expect(moodFit({ ...calm, themes: ["nature", "graphic violence"] }, gentle)).toBeCloseTo(moodFit(calm, gentle) - 0.25);
  });

  it("weighs mood and taste equally", () => {
    expect(moodScore(0.8, 60)).toBe(70);
    expect(moodScore(0.8, null)).toBe(65);
  });
});

describe("varied picks", () => {
  it("never picks two from the same franchise or collection", () => {
    const ranked = [
      { key: "a", franchise: "marvel", collection: 1 },
      { key: "b", franchise: "marvel", collection: 2 },
      { key: "c", franchise: null, collection: 1 },
      { key: "d", franchise: null, collection: null },
      { key: "e", franchise: null, collection: 3 },
    ];
    expect(pickVaried(ranked).map((r) => r.key)).toEqual(["a", "d", "e"]);
    // A swap respects the picks already on screen.
    expect(pickVaried(ranked, 1, [ranked[3]!, ranked[4]!]).map((r) => r.key)).toEqual(["a"]);
  });
});
