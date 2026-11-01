import { describe, expect, it } from "vitest";
import { askOrder, avoids, genreFit, passesConstraints, quality, retrievalScore, tagFit, widenGenres, type AskDoc, type Constraints } from "@/lib/reco/ask-score";

const c = (over: Partial<Constraints> = {}): Constraints => ({
  format: "any",
  genres: [],
  tags: [],
  avoid: [],
  runtimeMax: null,
  yearFrom: null,
  yearTo: null,
  language: null,
  ...over,
});
const doc = (over: Partial<AskDoc> = {}): AskDoc => ({
  category: "movie",
  mediaType: "movie",
  runtime: 120,
  year: 2015,
  originalLanguage: "en",
  genres: ["Adventure", "Science Fiction"],
  keywords: ["dinosaur", "theme park"],
  vibe: { themes: ["survival", "hubris"], mood: ["tense", "thrilling"] },
  voteAverage: 6.7,
  voteCount: 20000,
  posterPath: "/p.jpg",
  ...over,
});

describe("ask constraints", () => {
  it("enforces format, length (films only), era, language and avoided genres", () => {
    expect(passesConstraints(doc(), c())).toBe(true);
    expect(passesConstraints(doc(), c({ format: "series" }))).toBe(false);
    expect(passesConstraints(doc({ runtime: 150 }), c({ runtimeMax: 120 }))).toBe(false);
    expect(passesConstraints(doc({ mediaType: "tv", category: "series", runtime: 150 }), c({ runtimeMax: 120 }))).toBe(true);
    expect(passesConstraints(doc({ year: 1990 }), c({ yearFrom: 2000 }))).toBe(false);
    expect(passesConstraints(doc(), c({ language: "ko" }))).toBe(false);
    expect(passesConstraints(doc(), c({ avoid: ["science fiction"] }))).toBe(false);
    expect(passesConstraints(doc({ posterPath: null }), c())).toBe(false);
  });
});

describe("ask fit", () => {
  it("matches tags tolerantly and genres exactly", () => {
    expect(tagFit(doc(), c({ tags: ["survival", "tension", "romance"] }))).toBeCloseTo(1 / 3);
    expect(tagFit(doc(), c({ tags: ["theme-park"] }))).toBe(1);
    expect(tagFit(doc(), c())).toBeNull();
    expect(genreFit(doc(), c({ genres: ["Horror", "Science Fiction"] }))).toBe(0.5);
    expect(avoids(doc(), c({ avoid: ["dinosaurs"] }))).toBe(true);
  });
  it("prefers well-liked, well-known titles, gently", () => {
    expect(quality(doc({ voteAverage: 8.5, voteCount: 30000 }))).toBeGreaterThan(quality(doc({ voteAverage: 6, voteCount: 50 })));
    expect(quality(doc({ voteAverage: 4 }))).toBe(0);
  });
  it("renormalises retrieval over what it has and penalises avoided tags", () => {
    expect(retrievalScore({ vector: null, tags: null, genres: null, quality: 0.5, avoided: false })).toBeCloseTo(0.5);
    const base = { vector: 0.9, tags: 0.5, genres: 1, quality: 0.6 };
    expect(retrievalScore({ ...base, avoided: true })).toBeCloseTo(retrievalScore({ ...base, avoided: false }) - 0.4);
  });
  it("orders by 0.55 fit + 0.45 match, falling back to whichever exists", () => {
    expect(askOrder(80, 60)).toBeCloseTo(0.71);
    expect(askOrder(80, null)).toBeCloseTo(0.8);
    expect(askOrder(null, 60)).toBeCloseTo(0.6);
  });
  it("widens movie genres to their TV names", () => {
    expect(widenGenres(["Science Fiction", "Horror"])).toEqual(["Science Fiction", "Sci-Fi & Fantasy", "Horror"]);
  });
});

describe("model id resolution", () => {
  it("accepts keys, bare TMDB ids and titles, and rejects strangers", async () => {
    const { idResolver } = await import("@/lib/ai/ask");
    const cand = (id: string, title: string, year: number) => ({ id, title, year, kind: "film", genres: [], runtime: null, vibe: null, tags: [], rating: null });
    const resolve = idResolver([cand("movie:348", "Alien", 1979), cand("movie:329", "Jurassic Park", 1993), cand("tv:329", "Other Show", 2001)]);
    expect(resolve("movie:348")).toBe("movie:348");
    expect(resolve("[movie:348]")).toBe("movie:348");
    expect(resolve("348")).toBe("movie:348");
    expect(resolve("329")).toBeNull(); // ambiguous between movie and tv
    expect(resolve("Jurassic Park")).toBe("movie:329");
    expect(resolve("Alien (1979)")).toBe("movie:348");
    expect(resolve("movie:999")).toBeNull();
  });
});
