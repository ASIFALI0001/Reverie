import { describe, expect, it } from "vitest";
import { fallbackVerdict, namesIn, ratingTrend, seasonChart, spoilerProblems, type Ep } from "@/lib/series/trend";

/** Two seasons of eight: a slow start that picks up from S1E5, a strong second season. */
const show: Ep[] = [
  ...[7.1, 7.0, 6.9, 7.0, 7.6, 7.9, 8.2, 8.6].map((rating, i) => ({ season: 1, episode: i + 1, rating, votes: 120 })),
  ...[8.4, 8.5, 8.3, 8.8, 9.1, 8.7, 8.9, 9.4].map((rating, i) => ({ season: 2, episode: i + 1, rating, votes: 90 })),
];

describe("rating trend after where you are", () => {
  it("compares what's ahead with what you've seen, and finds where it picks up", () => {
    const t = ratingTrend(show, { season: 1, episode: 4 });
    expect(t.watchedAvg).toBe(7);
    expect(t.nextAvg).toBeGreaterThan(8);
    expect(t.delta).toBeGreaterThan(1);
    // The first three-episode stretch clearly above 7.0 ends at S1E7.
    expect(t.pickup).toEqual({ season: 1, episode: 7 });
    expect(t.peaksAhead[0]).toEqual({ season: 2, episode: 8 });
    expect(t.episodesAhead).toBe(12);
    expect(t.soon).toEqual({ season: 1, episode: 7 });
  });

  it("ignores thinly voted episodes", () => {
    const thin = show.map((e) => (e.season === 2 ? { ...e, votes: 2 } : e));
    expect(ratingTrend(thin, { season: 1, episode: 8 }).nextAvg).toBeNull();
  });
});

describe("season chart", () => {
  it("averages each season and keeps gaps for unrated episodes", () => {
    const chart = seasonChart([...show, { season: 2, episode: 9, rating: 8, votes: 1 }]);
    expect(chart.map((s) => s.season)).toEqual([1, 2]);
    expect(chart[0]!.avg).toBe(7.5);
    expect(chart[1]!.episodes.at(-1)).toEqual({ episode: 9, rating: null });
  });
});

describe("the plain verdict", () => {
  it("says keep going when it climbs", () => {
    const v = fallbackVerdict(ratingTrend(show, { season: 1, episode: 4 }));
    expect(v.verdict).toBe("keep");
    expect(v.reasons[0]).toMatch(/^Ratings climb from here/);
  });

  it("says stop when it falls away with no pickup", () => {
    const fading = show.map((e, i) => ({ ...e, rating: 9 - i * 0.2 }));
    expect(fallbackVerdict(ratingTrend(fading, { season: 1, episode: 4 })).verdict).toBe("stop");
  });

  it("never mentions story, only pace and quality", () => {
    for (const r of fallbackVerdict(ratingTrend(show, { season: 1, episode: 4 })).reasons) expect(spoilerProblems([r], { known: "", later: "" })).toEqual([]);
  });
});

describe("spoiler check", () => {
  const context = {
    known: "A chemistry teacher, Walter, turns to cooking meth with his former student Jesse in Albuquerque.",
    later: "Gus Fring offers Walter a deal. Hank closes in. Tuco returns to the scene.",
  };

  it("flags names that only appear after your episode", () => {
    expect(spoilerProblems(["Things get tense once Gus Fring enters the picture."], context)).toEqual(["names “Gus Fring”, who only appears later"]);
    expect(spoilerProblems(["Walter’s story gets darker and tighter."], context)).toEqual([]);
  });

  it("flags talk of events, whatever the names", () => {
    expect(spoilerProblems(["A major character dies in season two."], context)[0]).toMatch(/talks about events/);
    expect(spoilerProblems(["The twist in season two is worth it."], context)[0]).toMatch(/twist/);
    expect(spoilerProblems(["The pace picks up a lot in the second half."], context)).toEqual([]);
  });

  it("finds capitalised names, skipping ordinary sentence starts", () => {
    expect([...namesIn("The season ends in New Mexico with Saul.")].sort()).toEqual(["New Mexico", "Saul"]);
  });
});
