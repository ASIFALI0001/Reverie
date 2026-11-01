import { describe, expect, it } from "vitest";
import { decay, mergeSignals, ratingWeight, WEIGHTS, type SignalInputs } from "@/lib/reco/weights";
import {
  affinityScore,
  computeAffinities,
  fallbackDna,
  radarFrom,
  vibePreference,
  type TitleFeatures,
} from "@/lib/reco/affinity";
import { answerShare, tasteVectorFrom } from "@/lib/reco/taste-vector";
import { cosine } from "@/lib/reco/vector";
import { chipMatches, chipById, knownChips } from "@/lib/taste/chips";
import type { TasteAnswers } from "@/lib/taste/types";
import type { TitleKey } from "@/lib/catalog/types";

const NOW = new Date("2026-10-24T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const empty: SignalInputs = { library: [], watchlist: [], swipes: [], favourites: [] };

const answers = (over: Partial<TasteAnswers> = {}): TasteAnswers => ({
  formats: [],
  genres: [],
  pace: null,
  tone: null,
  complexity: null,
  era: null,
  endings: null,
  subtitles: null,
  languages: [],
  ...over,
});

function feat(key: TitleKey, over: Partial<TitleFeatures> = {}): TitleFeatures {
  return {
    key,
    title: key,
    year: 2010,
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

describe("signal weights (brief §5.2)", () => {
  it("maps 1–10 ratings onto the four bands", () => {
    expect([10, 9, 8, 7, 6, 5, 4, 1].map(ratingWeight)).toEqual([1, 1, 0.6, 0.6, 0.1, 0.1, -0.7, -0.7]);
  });

  it("decays gently and never below 60%", () => {
    expect(decay(0)).toBeCloseTo(1);
    expect(decay(365)).toBeCloseTo(0.6 + 0.4 / Math.E);
    expect(decay(100_000)).toBeCloseTo(0.6);
    expect(decay(-5)).toBeCloseTo(1);
  });

  it("takes the most deliberate source per title", () => {
    const signals = mergeSignals(
      {
        library: [
          { key: "movie:1", status: "watched", rating: 4, at: NOW },
          { key: "movie:2", status: "dropped", rating: null, at: NOW },
          { key: "movie:3", status: "watching", rating: null, at: NOW },
        ],
        watchlist: [{ key: "movie:4", at: NOW }],
        swipes: [
          { key: "movie:1", verdict: "loved", at: NOW }, // the rating wins
          { key: "movie:2", verdict: "loved", at: NOW }, // dropping wins
          { key: "movie:5", verdict: "unseen", at: NOW }, // no signal at all
          { key: "movie:6", verdict: "disliked", at: NOW },
        ],
        favourites: [],
      },
      NOW,
    );
    const by = Object.fromEntries(signals.map((s) => [s.key, s]));
    expect(by["movie:1"]).toMatchObject({ type: "disliked", source: "rating", weight: -0.7 });
    expect(by["movie:2"]).toMatchObject({ type: "dropped", weight: WEIGHTS.dropped });
    expect(by["movie:3"]?.weight).toBeCloseTo(WEIGHTS.watching);
    expect(by["movie:4"]).toMatchObject({ type: "watchlisted", weight: WEIGHTS.watchlisted });
    expect(by["movie:5"]).toBeUndefined();
    expect(by["movie:6"]).toMatchObject({ type: "disliked", source: "swipe", weight: WEIGHTS.swipeDisliked });
  });

  it("favourites lift positive ratings, lose to low ones, and never decay", () => {
    const signals = mergeSignals(
      {
        ...empty,
        library: [
          { key: "movie:1", status: "watched", rating: 8, at: daysAgo(900) },
          { key: "movie:2", status: "watched", rating: 3, at: NOW },
        ],
        favourites: [
          { key: "movie:1", at: daysAgo(900) },
          { key: "movie:2", at: NOW },
          { key: "movie:3", at: daysAgo(3000) },
        ],
      },
      NOW,
    );
    const by = Object.fromEntries(signals.map((s) => [s.key, s]));
    expect(by["movie:1"]).toMatchObject({ source: "favourite", weight: WEIGHTS.favourite });
    expect(by["movie:2"]?.weight).toBe(-0.7);
    expect(by["movie:3"]?.weight).toBe(WEIGHTS.favourite);
  });

  it("applies decay to older ratings", () => {
    const [s] = mergeSignals({ ...empty, library: [{ key: "movie:1", status: "watched", rating: 10, at: daysAgo(365) }] }, NOW);
    expect(s!.weight).toBeCloseTo(decay(365));
  });
});

describe("affinities", () => {
  it("shrinks thin evidence and saturates strong evidence", () => {
    expect(affinityScore(0, 0)).toBe(0);
    expect(affinityScore(0.8, 1)).toBeCloseTo(Math.tanh(1.6 / 3));
    expect(affinityScore(8, 10)).toBeGreaterThan(0.85);
    expect(affinityScore(-2.1, 3)).toBeLessThan(-0.6);
  });

  it("learns genres, themes, people and franchises from signals", () => {
    const features = new Map<TitleKey, TitleFeatures>([
      ["movie:1", feat("movie:1", { genres: ["Science Fiction", "Drama"], themes: ["identity"], people: ["d:1"], collection: "c:9", franchises: ["f:x"] })],
      ["movie:2", feat("movie:2", { genres: ["Science Fiction"], themes: ["identity"], people: ["d:1"] })],
      ["movie:3", feat("movie:3", { genres: ["Horror"], themes: ["gore"], language: "ko" })],
    ]);
    const signals = mergeSignals(
      {
        ...empty,
        library: [
          { key: "movie:1", status: "watched", rating: 10, at: NOW },
          { key: "movie:2", status: "watched", rating: 9, at: NOW },
          { key: "movie:3", status: "watched", rating: 2, at: NOW },
        ],
      },
      NOW,
    );
    const aff = computeAffinities(signals, features, null);
    const g = Object.fromEntries(aff.genre.map((a) => [a.term, a.value]));
    expect(g["Science Fiction"]).toBeGreaterThan(0.6);
    expect(g["Horror"]).toBeLessThan(-0.2);
    expect(aff.keyword.map((k) => k.term)).toContain("identity"); // seen twice
    expect(aff.keyword.map((k) => k.term)).not.toContain("gore"); // a single sighting isn't a pattern
    expect(aff.people[0]).toMatchObject({ term: "d:1", n: 2 });
    expect(aff.collection.map((c) => c.term).sort()).toEqual(["c:9", "f:x"]);
    expect(aff.language.find((l) => l.term === "ko")!.value).toBeLessThan(0);
  });

  it("treats onboarding picks as priors, even with no signals yet", () => {
    const aff = computeAffinities([], new Map(), answers({ genres: ["sci-fi", "dark", "nonsense"], languages: ["hi"] }));
    const g = Object.fromEntries(aff.genre.map((a) => [a.term, a.value]));
    expect(g["Science Fiction"]).toBeGreaterThan(0);
    expect(g["Sci-Fi & Fantasy"]).toBeGreaterThan(0);
    expect(aff.keyword.map((k) => k.term)).toContain("bleak"); // a "dark" mood tag survives the n ≥ 2 filter
    expect(aff.language).toEqual([expect.objectContaining({ term: "hi" })]);
  });
});

describe("vibe preference", () => {
  const features = new Map<TitleKey, TitleFeatures>([
    ["movie:1", feat("movie:1", { vibe: { pace: 0.2, tone: 0.9, complexity: 0.8 } })],
  ]);
  const loved = mergeSignals({ ...empty, library: [{ key: "movie:1", status: "watched", rating: 10, at: NOW }] }, NOW);

  it("is null with nothing to go on", () => {
    expect(vibePreference([], new Map(), null)).toBeNull();
  });
  it("uses titles alone, answers alone, or blends both", () => {
    expect(vibePreference(loved, features, null)).toEqual({ pace: 0.2, tone: 0.9, complexity: 0.8 });
    expect(vibePreference([], new Map(), answers({ pace: 1 }))).toEqual({ pace: 1, tone: 0.5, complexity: 0.5 });
    expect(vibePreference(loved, features, answers({ pace: 1 }))!.pace).toBeCloseTo(0.6);
  });
  it("falls back to the lean of picked moods when a slider is untouched", () => {
    expect(vibePreference([], new Map(), answers({ genres: ["slow-burn"] }))!.pace).toBe(0.25);
    expect(vibePreference([], new Map(), answers({ genres: ["slow-burn"], pace: 0.9 }))!.pace).toBe(0.9);
  });
  it("ignores titles the viewer disliked", () => {
    const disliked = mergeSignals({ ...empty, library: [{ key: "movie:1", status: "watched", rating: 2, at: NOW }] }, NOW);
    expect(vibePreference(disliked, features, null)).toBeNull();
  });
});

describe("radar + taste DNA", () => {
  it("is neutral (0.5) on every axis without evidence", () => {
    const radar = radarFrom([]);
    expect(radar).toHaveLength(8);
    expect(radar.every((p) => p.value === 0.5 && p.evidence === 0)).toBe(true);
  });
  it("weights each axis by evidence and stays within 0–1", () => {
    const radar = radarFrom([
      { term: "Thriller", value: 0.8, n: 6 },
      { term: "Crime", value: -0.2, n: 2 },
      { term: "Horror", value: -0.9, n: 3 },
    ]);
    const by = Object.fromEntries(radar.map((p) => [p.axis, p]));
    expect(by.Thriller!.value).toBeCloseTo((((0.8 * 6 - 0.2 * 2) / 8) + 1) / 2);
    expect(by.Thriller!.evidence).toBe(6);
    expect(by.Horror!.value).toBeCloseTo(0.05);
    expect(radar.every((p) => p.value >= 0 && p.value <= 1)).toBe(true);
  });
  it("always produces 3–4 honest phrases", () => {
    const thin = fallbackDna({ genre: [], keyword: [], people: [], collection: [], language: [] }, null, null);
    expect(thin.length).toBeGreaterThanOrEqual(3);
    const rich = fallbackDna(
      {
        genre: [
          { term: "Science Fiction", value: 0.8, n: 5 },
          { term: "Thriller", value: 0.6, n: 4 },
          { term: "Horror", value: -0.7, n: 3 },
        ],
        keyword: [],
        people: [],
        collection: [],
        language: [],
      },
      { pace: 0.2, tone: 0.8, complexity: 0.8 },
      null,
    );
    expect(rich[0]).toBe("Drawn to sci-fi and thriller");
    expect(rich).toHaveLength(4);
    expect(rich.join(" ")).toContain("slow burn");
  });
});

describe("taste vector", () => {
  const A = [1, 0, 0];
  const B = [0, 1, 0];
  const C = [0, 0, 1];

  it("is null with nothing, and the answer vector alone before any signals", () => {
    expect(tasteVectorFrom([], null)).toBeNull();
    expect(tasteVectorFrom([], [0, 3, 4])).toEqual([0, 0.6, 0.8]);
  });
  it("points toward liked titles and away from disliked ones", () => {
    const v = tasteVectorFrom([{ vector: A, weight: 1 }, { vector: B, weight: -0.7 }], null)!;
    expect(cosine(v, A)).toBeGreaterThan(0.85);
    expect(cosine(v, B)).toBeLessThan(0);
  });
  it("lets the answers steer less as evidence grows", () => {
    expect(answerShare(2)).toBeGreaterThan(answerShare(10));
    expect(answerShare(10)).toBeGreaterThan(answerShare(40));
    const few = tasteVectorFrom([{ vector: A, weight: 1 }], C)!;
    const many = tasteVectorFrom(Array.from({ length: 20 }, () => ({ vector: A, weight: 1 })), C)!;
    expect(cosine(few, C)).toBeGreaterThan(cosine(many, C));
    expect(cosine(many, A)).toBeGreaterThan(0.95);
  });
});

describe("chips", () => {
  it("drops unknown ids and matches by genre, mood tag or vibe scale", () => {
    expect(knownChips(["sci-fi", "sci-fi", "bogus"]).map((c) => c.id)).toEqual(["sci-fi"]);
    const vibe = { pace: 0.2, tone: 0.5, complexity: 0.5, mood: ["cozy"], themes: [] };
    expect(chipMatches(chipById("sci-fi")!, { genres: ["Sci-Fi & Fantasy"], vibe: null })).toBe(true);
    expect(chipMatches(chipById("cozy")!, { genres: [], vibe })).toBe(true);
    expect(chipMatches(chipById("slow-burn")!, { genres: [], vibe })).toBe(true);
    expect(chipMatches(chipById("dark")!, { genres: [], vibe })).toBe(false);
  });
});
