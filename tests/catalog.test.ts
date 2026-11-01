import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categorize } from "@/lib/catalog/category";
import { detectFranchises } from "@/lib/catalog/franchises";
import { excerpt, normalizeTmdb, type TmdbDetails } from "@/lib/catalog/normalize";
import { parseTitleKey, titleKey } from "@/lib/catalog/types";
import { clampAccent, contrastRatio, hexToOklch, oklchToHex } from "@/lib/color/oklch";

const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/tmdb/${name}.json`, "utf8")) as TmdbDetails;

describe("category rules (brief §5.1)", () => {
  const cases: [string, "movie" | "tv", string][] = [
    ["movie-68721", "movie", "movie"], // Iron Man 3
    ["movie-579974", "movie", "movie"], // RRR (Telugu, live action)
    ["movie-129", "movie", "anime"], // Spirited Away — Japanese animation film
    ["movie-862", "movie", "cartoon"], // Toy Story
    ["tv-13916", "tv", "anime"], // Death Note
    ["tv-246", "tv", "cartoon"], // Avatar: The Last Airbender
    ["tv-1396", "tv", "series"], // Breaking Bad
  ];
  for (const [name, mediaType, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      expect(normalizeTmdb(fixture(name), mediaType).category).toBe(expected);
    });
  }
  it("treats Japanese-language animation as anime even when produced elsewhere", () => {
    expect(categorize({ mediaType: "tv", genreIds: [16], originCountry: ["US"], originalLanguage: "ja" })).toBe("anime");
  });
  it("treats non-Japanese animation (e.g. donghua) as cartoon", () => {
    expect(categorize({ mediaType: "tv", genreIds: [16, 10759], originCountry: ["CN"], originalLanguage: "zh" })).toBe("cartoon");
  });
});

describe("normalizeTmdb — Iron Man 3", () => {
  const t = normalizeTmdb(fixture("movie-68721"), "movie");
  it("keeps identity, year, runtime and IMDb id", () => {
    expect(t.key).toBe("movie:68721");
    expect(t.title).toBe("Iron Man 3");
    expect(t.year).toBe(2013);
    expect(t.runtime).toBe(130);
    expect(t.imdbId).toBe("tt1300854");
  });
  it("finds the director, cast and collection", () => {
    expect(t.directors.map((d) => d.name)).toContain("Shane Black");
    expect(t.topCast[0]?.name).toBe("Robert Downey Jr.");
    expect(t.topCast.length).toBeLessThanOrEqual(12);
    expect(t.collection?.name).toBe("Iron Man Collection");
  });
  it("tags it as Marvel and records certifications per region", () => {
    expect(t.franchises).toContain("marvel");
    expect(Object.keys(t.certification)).toEqual(expect.arrayContaining(["US"]));
  });
  it("keeps only YouTube trailers/teasers and links recommendations by key", () => {
    expect(t.videos.length).toBeGreaterThan(0);
    expect(t.tmdbRecs.every((k) => /^(movie|tv):\d+$/.test(k))).toBe(true);
  });
});

describe("normalizeTmdb — series and anime", () => {
  it("Breaking Bad has seasons, episodes, creators and an episode runtime", () => {
    const t = normalizeTmdb(fixture("tv-1396"), "tv");
    expect(t.seasons).toBe(5);
    expect(t.episodes).toBe(62);
    expect(t.creators.map((c) => c.name)).toContain("Vince Gilligan");
    expect(t.runtime).toBeGreaterThan(30);
  });
  it("Jurassic World joins the Jurassic franchise shelf", () => {
    expect(normalizeTmdb(fixture("movie-135397"), "movie").franchises).toContain("jurassic");
  });
  it("Toy Story joins Pixar", () => {
    expect(normalizeTmdb(fixture("movie-862"), "movie").franchises).toContain("pixar");
  });
});

describe("franchise detection", () => {
  it("matches by company, collection or keyword", () => {
    expect(detectFranchises({ companyIds: [10342], collectionId: null, keywordIds: [] })).toEqual(["ghibli"]);
    expect(detectFranchises({ companyIds: [], collectionId: 10, keywordIds: [] })).toEqual(["star-wars"]);
    expect(detectFranchises({ companyIds: [], collectionId: null, keywordIds: [180547] })).toEqual(["marvel"]);
    expect(detectFranchises({ companyIds: [999999], collectionId: 1, keywordIds: [] })).toEqual([]);
  });
});

describe("title keys", () => {
  it("round-trips", () => {
    expect(parseTitleKey(titleKey("tv", 1396))).toEqual({ mediaType: "tv", tmdbId: 1396 });
    expect(parseTitleKey("person:1")).toBeNull();
  });
});

describe("review excerpts", () => {
  it("cuts at a sentence boundary", () => {
    const text = "First sentence is fine. Second sentence is also fine. " + "x".repeat(500);
    expect(excerpt(text, 80)).toBe("First sentence is fine. Second sentence is also fine.");
  });
});

describe("accent colours from posters", () => {
  it("round-trips hex through OKLCH", () => {
    expect(oklchToHex(hexToOklch("#b67134"))).toBe("#b67134");
  });
  it("clamps a dark poster colour into a readable accent on the dark theme", () => {
    const accent = clampAccent("#831912", { minL: 0.7, maxL: 0.8, maxC: 0.15 });
    expect(contrastRatio(accent, "#0c0b0a")).toBeGreaterThanOrEqual(4.5);
    // Hue survives (still a red).
    expect(Math.abs(hexToOklch(accent).h - hexToOklch("#831912").h)).toBeLessThan(12);
  });
  it("keeps near-grey (black-and-white) posters neutral", () => {
    expect(hexToOklch(clampAccent("#777777", { minL: 0.7, maxL: 0.8, maxC: 0.15 })).c).toBeLessThan(0.02);
  });
});
