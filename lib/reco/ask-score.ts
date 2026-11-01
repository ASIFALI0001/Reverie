import type { Category, MediaType } from "@/lib/catalog/types";

/** Scoring for natural-language search candidates (pure, unit-tested). */

export type Constraints = {
  format: Category | "any";
  /** TMDB genre names the request asks for. */
  genres: string[];
  /** Themes and moods, lowercase. */
  tags: string[];
  /** Genres or tags to stay away from, lowercase. */
  avoid: string[];
  runtimeMax: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  language: string | null;
};

export type AskDoc = {
  category: Category;
  mediaType: MediaType;
  runtime: number | null;
  year: number | null;
  originalLanguage: string;
  genres: string[];
  keywords: string[];
  vibe: { themes: string[]; mood: string[] } | null;
  voteAverage: number;
  voteCount: number;
  posterPath: string | null;
};

const norm = (s: string) => s.toLowerCase().trim();
const tagsOf = (d: AskDoc) => [...(d.vibe?.themes ?? []), ...(d.vibe?.mood ?? []), ...d.keywords.slice(0, 20)].map(norm);
/** "time travel" ≈ "time-travel", "tense" ≈ "tension": tolerant containment either way. */
const near = (a: string, b: string) => {
  const x = a.replace(/[^a-z0-9]+/g, " ").trim();
  const y = b.replace(/[^a-z0-9]+/g, " ").trim();
  return x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
};

/** Hard constraints: format, length (films), era, language, and genres they asked to avoid. */
export function passesConstraints(d: AskDoc, c: Constraints): boolean {
  if (!d.posterPath) return false;
  if (c.format !== "any" && d.category !== c.format) return false;
  if (c.runtimeMax && d.mediaType === "movie" && d.runtime && d.runtime > c.runtimeMax) return false;
  if (c.yearFrom && d.year && d.year < c.yearFrom) return false;
  if (c.yearTo && d.year && d.year > c.yearTo) return false;
  if (c.language && d.originalLanguage !== c.language) return false;
  const genres = d.genres.map(norm);
  return !c.avoid.some((a) => genres.includes(a));
}

/** Share of the requested themes/moods the title carries; null when none were asked for. */
export function tagFit(d: AskDoc, c: Constraints): number | null {
  if (!c.tags.length) return null;
  const have = tagsOf(d);
  return c.tags.filter((t) => have.some((h) => near(h, t))).length / c.tags.length;
}

export function genreFit(d: AskDoc, c: Constraints): number | null {
  if (!c.genres.length) return null;
  const g = new Set(d.genres);
  return c.genres.filter((x) => g.has(x)).length / c.genres.length;
}

/** Soft avoid: a tag they asked to avoid (genres are already a hard filter). */
export function avoids(d: AskDoc, c: Constraints): boolean {
  if (!c.avoid.length) return false;
  const have = tagsOf(d);
  return c.avoid.some((a) => have.some((h) => near(h, a)));
}

/** A gentle prior toward well-liked, well-known titles. */
export function quality(d: AskDoc): number {
  const liked = Math.min(1, Math.max(0, (d.voteAverage - 5) / 4));
  const known = Math.min(1, Math.log10(d.voteCount + 1) / 4);
  return liked * known;
}

export const RETRIEVAL_WEIGHTS = { vector: 0.45, tags: 0.25, genres: 0.2, quality: 0.1 } as const;

export function retrievalScore(p: { vector: number | null; tags: number | null; genres: number | null; quality: number; avoided: boolean }): number {
  const parts: [number, number | null][] = [
    [RETRIEVAL_WEIGHTS.vector, p.vector],
    [RETRIEVAL_WEIGHTS.tags, p.tags],
    [RETRIEVAL_WEIGHTS.genres, p.genres],
    [RETRIEVAL_WEIGHTS.quality, p.quality],
  ];
  let sum = 0;
  let weight = 0;
  for (const [w, v] of parts) {
    if (v == null) continue;
    sum += w * v;
    weight += w;
  }
  return (weight ? sum / weight : 0) - (p.avoided ? 0.4 : 0);
}

/** Final order (brief §5.5.5): 0.55 × fit to the request + 0.45 × match to the viewer. */
export function askOrder(fit: number | null, match: number | null): number {
  if (fit == null) return (match ?? 0) / 100;
  if (match == null) return fit / 100;
  return (0.55 * fit + 0.45 * match) / 100;
}

const TV_EQUIVALENT: Record<string, string> = {
  "Science Fiction": "Sci-Fi & Fantasy",
  Fantasy: "Sci-Fi & Fantasy",
  Action: "Action & Adventure",
  Adventure: "Action & Adventure",
  War: "War & Politics",
};

/** Requested genres, widened so a movie genre also finds series (Sci-Fi → Sci-Fi & Fantasy). */
export function widenGenres(genres: string[]): string[] {
  return [...new Set(genres.flatMap((g) => [g, ...(TV_EQUIVALENT[g] ? [TV_EQUIVALENT[g]!] : [])]))];
}
