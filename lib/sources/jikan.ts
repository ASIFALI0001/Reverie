import "server-only";
import pLimit from "p-limit";
import { cached, TTL } from "@/lib/cache/cached";
import { fetchJson } from "@/lib/sources/http";
import { normalizeTitle } from "@/lib/sources/youtube-classify";
import type { MediaType } from "@/lib/catalog/types";

export type JikanInfo = {
  malId: number;
  url: string;
  score: number | null;
  scoredBy: number | null;
  genres: string[];
  themes: string[];
  demographics: string[];
};

type JikanAnime = {
  mal_id: number;
  url: string;
  type: string | null;
  score: number | null;
  scored_by: number | null;
  year: number | null;
  aired?: { prop?: { from?: { year: number | null } } };
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  titles?: { type: string; title: string }[];
  genres: { name: string }[];
  themes: { name: string }[];
  demographics: { name: string }[];
};

// When Jikan is unreachable (it's an unofficial, sometimes-down API), stop trying for a while
// instead of stalling every anime behind connection timeouts.
const COOL_OFF_MS = 10 * 60_000;
let downUntil = 0;
const isNetworkFailure = (err: unknown) => {
  const e = err as { message?: string; cause?: { code?: string } };
  return /fetch failed|timed? ?out|aborted|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(`${e?.message} ${e?.cause?.code ?? ""}`);
};

// Jikan asks for ≤3 req/s; one at a time with spacing keeps us well clear.
const limit = pLimit(1);
let last = 0;
async function politely<T>(fn: () => Promise<T>) {
  return limit(async () => {
    const wait = Math.max(0, last + 400 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
}

function similarity(a: string, b: string) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ta = new Set(x.split(" "));
  const tb = new Set(y.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / new Set([...ta, ...tb]).size;
}

/** Score a MyAnimeList candidate against our title (name similarity + year + format). */
export function matchScore(c: JikanAnime, names: string[], year: number | null, mediaType: MediaType) {
  const candidateNames = [c.title, c.title_english, c.title_japanese, ...(c.titles ?? []).map((t) => t.title)].filter(Boolean) as string[];
  const nameScore = Math.max(...names.flatMap((n) => candidateNames.map((cn) => similarity(n, cn))));
  const cYear = c.year ?? c.aired?.prop?.from?.year ?? null;
  const yearScore = year && cYear ? (Math.abs(year - cYear) <= 1 ? 0.3 : -0.3) : 0;
  const typeOk = mediaType === "movie" ? c.type === "Movie" : c.type === "TV" || c.type === "ONA";
  return nameScore + yearScore + (typeOk ? 0.2 : -0.1);
}

/**
 * MyAnimeList data for an anime title, via Jikan. Null when there's no confident
 * match; "unavailable" when Jikan can't be reached (so callers can retry later).
 */
export async function findAnime(t: {
  key: string;
  title: string;
  originalTitle: string;
  year: number | null;
  mediaType: MediaType;
}): Promise<JikanInfo | null | "unavailable"> {
  if (Date.now() < downUntil) return "unavailable";
  try {
    return await cached<JikanInfo | null>(`jikan:${t.key}`, TTL.jikan, async () => {
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(t.title)}&limit=8&sfw=true`;
      const res = await politely(() => fetchJson<{ data: JikanAnime[] }>("Jikan", url, { retries: 1, timeoutMs: 6_000 }));
      const names = [t.title, t.originalTitle].filter(Boolean);
      const best = res.data
        .map((c) => ({ c, s: matchScore(c, names, t.year, t.mediaType) }))
        .sort((a, b) => b.s - a.s)[0];
      if (!best || best.s < 0.8) return null;
      const { c } = best;
      return {
        malId: c.mal_id,
        url: c.url,
        score: c.score,
        scoredBy: c.scored_by,
        genres: c.genres.map((g) => g.name),
        themes: c.themes.map((g) => g.name),
        demographics: c.demographics.map((g) => g.name),
      };
    });
  } catch (err) {
    if (isNetworkFailure(err)) {
      downUntil = Date.now() + COOL_OFF_MS;
      console.warn("[jikan] unreachable — pausing MAL lookups for 10 minutes");
    } else {
      console.warn("[jikan]", err instanceof Error ? err.message : err);
    }
    return "unavailable";
  }
}

/** MAL demographics/themes/genres → our anime shelf tags. */
export function animeTagsFromJikan(j: JikanInfo): string[] {
  const map: Record<string, string> = {
    Shounen: "shonen",
    Seinen: "seinen",
    Shoujo: "shojo",
    Josei: "josei",
    Isekai: "isekai",
    Mecha: "mecha",
    Psychological: "psychological",
    "Slice of Life": "slice-of-life",
    Romance: "romance",
    Sports: "sports",
  };
  return [...new Set([...j.demographics, ...j.themes, ...j.genres].map((n) => map[n]).filter(Boolean) as string[])];
}
