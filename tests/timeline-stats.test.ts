import { describe, expect, it } from "vitest";
import { highlights, topRated, type StatItem, type StatTitle } from "@/lib/timeline/stats";

const film = (title: string, genres: string[], directors: [number, string][] = [], posterPath: string | null = `/${title}.jpg`): StatTitle => ({
  title,
  mediaType: "movie",
  genres,
  directors: directors.map(([id, name]) => ({ id, name })),
  episodes: null,
  runtime: 120,
  posterPath,
});
const show = (title: string, episodes: number, runtime: number | null = 50): StatTitle => ({ title, mediaType: "tv", genres: ["Drama"], directors: [], episodes, runtime, posterPath: `/${title}.jpg` });
const item = (key: string, rating: number | null, status = "watched", day = 1): StatItem => ({ key, status, rating, watchedAt: new Date(Date.UTC(2026, 0, day)), addedAt: new Date(Date.UTC(2026, 0, day)) });

const titles = new Map<string, StatTitle>([
  ["movie:1", film("Interstellar", ["Science Fiction", "Drama"], [[525, "Christopher Nolan"]])],
  ["movie:2", film("Inception", ["Science Fiction", "Action"], [[525, "Christopher Nolan"]])],
  ["movie:3", film("Arrival", ["Science Fiction", "Mystery"], [[137, "Denis Villeneuve"]])],
  ["movie:4", film("Dune", ["Science Fiction"], [[137, "Denis Villeneuve"]])],
  ["movie:5", film("Tenet", ["Action"], [[525, "Christopher Nolan"]])],
  ["tv:1", show("Breaking Bad", 62, 47)],
  ["tv:2", show("Fleabag", 12, 27)],
]);

describe("highlights", () => {
  it("finds the most-watched genre, best title, favourite director and longest finished series", () => {
    const h = highlights([item("movie:1", 10, "watched", 3), item("movie:2", 9), item("movie:3", 10, "watched", 5), item("movie:4", 8), item("tv:1", 9), item("tv:2", 8)], titles);
    expect(h.topGenre).toEqual({ name: "Science Fiction", titles: 4 });
    // Two 10s: the more recent wins.
    expect(h.highestRated).toEqual({ key: "movie:3", title: "Arrival", rating: 10 });
    // Two each: the higher average decides (Nolan 9.5 vs Villeneuve 9).
    expect(h.director).toEqual({ name: "Christopher Nolan", titles: 2 });
    expect(h.binge).toEqual({ key: "tv:1", title: "Breaking Bad", episodes: 62, hours: 49 });
  });

  it("leaves dropped titles and low ratings out of the director count", () => {
    const h = highlights([item("movie:1", 9), item("movie:2", 4), item("movie:5", null, "dropped"), item("movie:3", 8), item("movie:4", null)], titles);
    // Nolan: one film left (Inception rated 4, Tenet dropped); Villeneuve: two.
    expect(h.director).toEqual({ name: "Denis Villeneuve", titles: 2 });
  });

  it("needs two films for a favourite director and a finished series for a binge", () => {
    const h = highlights([item("movie:1", 9), item("movie:3", 9), item("tv:1", null, "watching")], titles);
    expect(h.director).toBeNull();
    expect(h.binge).toBeNull();
  });

  it("is empty without titles, and ignores titles it can't find", () => {
    expect(highlights([], titles)).toEqual({ topGenre: null, highestRated: null, director: null, binge: null });
    expect(highlights([item("movie:999", 10)], titles).highestRated).toBeNull();
  });
});

describe("topRated", () => {
  it("takes the best three with posters, newest first among equals, never dropped ones", () => {
    const withoutPoster = new Map(titles).set("movie:6", film("No Poster", ["Drama"], [], null));
    const top = topRated([item("movie:1", 10, "watched", 2), item("movie:3", 10, "watched", 9), item("movie:6", 10), item("movie:2", 9, "dropped"), item("movie:4", 8), item("tv:1", 7)], withoutPoster);
    expect(top.map((t) => t.title)).toEqual(["Arrival", "Interstellar", "Dune"]);
  });
});
