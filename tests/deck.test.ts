import { describe, expect, it } from "vitest";
import { hashSeed, pickDeck, quotas, rng, type DeckCandidate } from "@/lib/taste/deck";
import { chipById, chipMatches } from "@/lib/taste/chips";
import type { Category } from "@/lib/catalog/types";

const GENRES = ["Action", "Comedy", "Drama", "Horror", "Science Fiction", "Romance", "Thriller", "Family"];

/** A synthetic catalog: 60 titles per format with varied genres, fame, collections and languages. */
function catalog(): DeckCandidate[] {
  const random = rng(7);
  const out: DeckCandidate[] = [];
  const cats: Category[] = ["movie", "series", "anime", "cartoon"];
  let id = 1;
  for (const category of cats) {
    for (let i = 0; i < 60; i++, id++) {
      const g = GENRES[i % GENRES.length]!;
      out.push({
        key: `${category === "movie" || category === "cartoon" ? "movie" : "tv"}:${id}`,
        category,
        title: `${category} ${i}`,
        genres: [g, GENRES[(i + 3) % GENRES.length]!],
        vibe: { pace: random(), tone: random(), complexity: random(), mood: [], themes: [] },
        voteCount: Math.round(500 + random() * 30_000),
        originalLanguage: i % 9 === 0 ? "hi" : "en",
        // Every fifth film shares one collection (think: a franchise with many entries).
        collectionId: category === "movie" && i % 5 === 0 ? 99 : null,
        franchises: category === "movie" && i % 4 === 0 ? ["marvel"] : [],
        hasEmbedding: i % 3 !== 0,
      });
    }
  }
  return out;
}

describe("deck quotas", () => {
  it("splits by weight and sums to the deck size", () => {
    const q = quotas(["movie", "series", "anime", "cartoon"], { movie: 99, series: 99, anime: 99, cartoon: 99 }, 20);
    expect(q.movie + q.series + q.anime + q.cartoon).toBe(20);
    expect(q.movie).toBeGreaterThan(q.series);
    expect(q.series).toBeGreaterThanOrEqual(q.anime);
  });
  it("hands a short format's leftovers to the others", () => {
    const q = quotas(["movie", "anime"], { movie: 99, series: 0, anime: 2, cartoon: 0 }, 20);
    expect(q).toEqual({ movie: 18, series: 0, anime: 2, cartoon: 0 });
  });
  it("never asks for more than exists", () => {
    const q = quotas(["anime"], { movie: 0, series: 0, anime: 5, cartoon: 0 }, 20);
    expect(q.anime).toBe(5);
  });
});

describe("pickDeck", () => {
  const cands = catalog();

  it("returns 20 distinct titles from the chosen formats only", () => {
    const deck = pickDeck(cands, { formats: ["movie", "anime"], chips: [], boostLanguages: [], seed: 1 });
    expect(deck).toHaveLength(20);
    expect(new Set(deck.map((d) => d.key)).size).toBe(20);
    expect(deck.every((d) => d.category === "movie" || d.category === "anime")).toBe(true);
  });

  it("is deterministic per seed and varies between seeds", () => {
    const a = pickDeck(cands, { formats: [], chips: [], boostLanguages: [], seed: hashSeed("u1:2026-10-24") });
    const b = pickDeck(cands, { formats: [], chips: [], boostLanguages: [], seed: hashSeed("u1:2026-10-24") });
    const c = pickDeck(cands, { formats: [], chips: [], boostLanguages: [], seed: hashSeed("u2:2026-10-24") });
    expect(a.map((d) => d.key)).toEqual(b.map((d) => d.key));
    expect(a.map((d) => d.key)).not.toEqual(c.map((d) => d.key));
  });

  it("keeps one title per collection and spreads franchises", () => {
    const deck = pickDeck(cands, { formats: ["movie"], chips: [], boostLanguages: [], seed: 3 });
    expect(deck.filter((d) => d.collectionId === 99)).toHaveLength(1);
    expect(deck.filter((d) => d.franchises.includes("marvel")).length).toBeLessThanOrEqual(3);
  });

  it("mostly matches the picked chips but keeps contrast titles", () => {
    const deck = pickDeck(cands, { formats: [], chips: ["horror"], boostLanguages: [], seed: 4 });
    const horror = chipById("horror")!;
    const matched = deck.filter((d) => chipMatches(horror, { genres: d.genres, vibe: d.vibe })).length;
    expect(matched).toBeGreaterThanOrEqual(11);
    expect(matched).toBeLessThanOrEqual(15);
  });

  it("opens with the best-known title and avoids two of a format in a row", () => {
    const deck = pickDeck(cands, { formats: [], chips: [], boostLanguages: [], seed: 5 });
    expect(deck[0]!.voteCount).toBe(Math.max(...deck.map((d) => d.voteCount)));
    let repeats = 0;
    for (let i = 1; i < deck.length; i++) if (deck[i]!.category === deck[i - 1]!.category) repeats++;
    expect(repeats).toBeLessThanOrEqual(3);
  });

  it("nudges in titles from boosted languages", () => {
    const plain = pickDeck(cands, { formats: ["movie"], chips: [], boostLanguages: [], seed: 6 });
    const boosted = pickDeck(cands, { formats: ["movie"], chips: [], boostLanguages: ["hi"], seed: 6 });
    const hindi = (d: DeckCandidate[]) => d.filter((x) => x.originalLanguage === "hi").length;
    expect(hindi(boosted)).toBeGreaterThan(hindi(plain));
  });
});
