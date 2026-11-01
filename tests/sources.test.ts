import { describe, expect, it } from "vitest";
import { classifyVideo, groupVideos, isAbout, parseIsoDuration, type RawVideo } from "@/lib/sources/youtube-classify";
import { parseOmdb } from "@/lib/sources/omdb";
import { animeTagsFromJikan, matchScore } from "@/lib/sources/jikan";
import { profileText } from "@/lib/catalog/profile-text";
import { normalizeTmdb, type TmdbDetails } from "@/lib/catalog/normalize";
import { readFileSync } from "node:fs";

const video = (title: string, extra: Partial<RawVideo> = {}): RawVideo => ({
  id: title,
  title,
  channel: "c",
  publishedAt: null,
  durationSec: 120,
  views: 1000,
  thumbnail: null,
  ...extra,
});

describe("YouTube helpers", () => {
  it("parses ISO-8601 durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT4M")).toBe(240);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
  });
  it("sorts videos into tabs", () => {
    expect(classifyVideo(video("Iron Man 3 | 4K Edit"))).toBe("edit");
    expect(classifyVideo(video("Iron Man 3 Review"))).toBe("review");
    expect(classifyVideo(video("Iron Man 3 Ending Explained"))).toBe("explained");
  });
  it("rejects long 'edits', piracy bait and unrelated videos", () => {
    expect(classifyVideo(video("Iron Man 3 edit", { durationSec: 1800 }))).toBeNull();
    expect(classifyVideo(video("Iron Man 3 FULL MOVIE free"))).toBeNull();
    expect(isAbout("Top 10 Marvel edits", "Iron Man 3", 2013)).toBe(false);
  });
  it("needs extra evidence for very short titles", () => {
    expect(isAbout("Up review", "Up", 2009)).toBe(false);
    expect(isAbout("Up (2009) review", "Up", 2009)).toBe(true);
    expect(isAbout("Pixar's Up movie review", "Up", 2009)).toBe(true);
  });
  it("groups, de-duplicates and ranks by views", () => {
    const g = groupVideos(
      [video("Iron Man 3 review A", { id: "a", views: 5 }), video("Iron Man 3 review B", { id: "b", views: 50 }), video("Iron Man 3 review B", { id: "b", views: 50 })],
      "Iron Man 3",
      2013,
    );
    expect(g.review.map((v) => v.id)).toEqual(["b", "a"]);
  });
});

describe("OMDb parsing", () => {
  it("reads IMDb, RT and Metacritic", () => {
    expect(
      parseOmdb({
        Response: "True",
        imdbRating: "7.1",
        imdbVotes: "880,123",
        Metascore: "62",
        Ratings: [{ Source: "Rotten Tomatoes", Value: "79%" }],
      }),
    ).toEqual({ imdb: 7.1, imdbVotes: 880123, rottenTomatoes: 79, metacritic: 62 });
  });
  it("turns N/A and missing values into null", () => {
    expect(parseOmdb({ Response: "True", imdbRating: "N/A" })).toEqual({ imdb: null, imdbVotes: null, rottenTomatoes: null, metacritic: null });
    expect(parseOmdb({ Response: "False", Error: "Movie not found!" }).imdb).toBeNull();
  });
});

describe("MyAnimeList matching", () => {
  const candidate = {
    mal_id: 1535,
    url: "",
    type: "TV",
    score: 8.62,
    scored_by: 1,
    year: 2006,
    title: "Death Note",
    title_english: "Death Note",
    title_japanese: "デスノート",
    genres: [{ name: "Supernatural" }],
    themes: [{ name: "Psychological" }],
    demographics: [{ name: "Shounen" }],
  };
  it("scores an exact title + year + format match above the threshold", () => {
    expect(matchScore(candidate, ["Death Note"], 2006, "tv")).toBeGreaterThanOrEqual(0.8);
  });
  it("penalises the wrong format and year", () => {
    expect(matchScore({ ...candidate, type: "Movie", year: 2017 }, ["Death Note"], 2006, "tv")).toBeLessThan(0.8);
  });
  it("maps demographics and themes to shelf tags", () => {
    expect(
      animeTagsFromJikan({ malId: 1, url: "", score: 8, scoredBy: 1, genres: ["Romance"], themes: ["Isekai"], demographics: ["Seinen"] }).sort(),
    ).toEqual(["isekai", "romance", "seinen"]);
  });
});

describe("profile text", () => {
  const core = normalizeTmdb(JSON.parse(readFileSync("tests/fixtures/tmdb/movie-68721.json", "utf8")) as TmdbDetails, "movie");
  it("leads with identity and includes people, story and feel", () => {
    const text = profileText(core, {
      summary: "Brisk, wisecracking and surprisingly vulnerable.",
      pace: 0.8,
      tone: 0.4,
      complexity: 0.3,
      themes: ["trauma", "identity"],
      mood: ["witty"],
    });
    expect(text.startsWith("Iron Man 3 (2013): an English-language movie")).toBe(true);
    expect(text).toContain("Directed by Shane Black");
    expect(text).toContain("Part of the Iron Man Collection");
    expect(text).toContain("Pace: fast and loud");
    expect(text).toContain("Themes: trauma, identity");
  });
  it("works without a vibe", () => {
    expect(profileText(core)).not.toContain("Feel:");
  });
});
