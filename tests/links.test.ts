import { describe, expect, it } from "vitest";
import { idFromSlug, isMediaType, titleHref, titleSlug } from "@/lib/catalog/links";
import { toCard, cardMeta } from "@/lib/catalog/cards";

describe("title links", () => {
  it("builds canonical, readable URLs", () => {
    expect(titleHref("movie", 68721, "Iron Man 3")).toBe("/title/movie/68721-iron-man-3");
    expect(titleHref("tv", 1396, "Breaking Bad")).toBe("/title/tv/1396-breaking-bad");
    expect(titleSlug(10, "!!!")).toBe("10");
  });
  it("reads the id back from any slug that starts with it", () => {
    expect(idFromSlug("68721-iron-man-3")).toBe(68721);
    expect(idFromSlug("68721")).toBe(68721);
    expect(idFromSlug("iron-man-3")).toBeNull();
  });
  it("only accepts the two media types", () => {
    expect(isMediaType("movie")).toBe(true);
    expect(isMediaType("person")).toBe(false);
  });
});

describe("cards", () => {
  const card = toCard({
    _id: "tv:1396",
    mediaType: "tv",
    tmdbId: 1396,
    category: "series",
    title: "Breaking Bad",
    year: 2008,
    posterPath: "/p.jpg",
    runtime: 47,
    seasons: 5,
    genres: ["Drama", "Crime", "Thriller", "Extra"],
    voteAverage: 8.9,
    colors: { dominant: "#556b2f" },
  });
  it("keeps three genres, the colour and a canonical href", () => {
    expect(card.genres).toHaveLength(3);
    expect(card.color).toBe("#556b2f");
    expect(card.href).toBe("/title/tv/1396-breaking-bad");
  });
  it("describes series by seasons and films by runtime", () => {
    expect(cardMeta(card)).toBe("5 seasons");
    expect(cardMeta({ mediaType: "movie", runtime: 130, seasons: null })).toBe("2h 10m");
  });
});
