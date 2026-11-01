import "server-only";
import { env } from "@/lib/env";
import { cached, TTL } from "@/lib/cache/cached";
import { fetchJson } from "@/lib/sources/http";
import { reserveQuota } from "@/lib/sources/quota";

export type OmdbRatings = {
  imdb: number | null;
  imdbVotes: number | null;
  rottenTomatoes: number | null;
  metacritic: number | null;
};

type OmdbResponse = {
  Response: "True" | "False";
  Error?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: { Source: string; Value: string }[];
};

const num = (s: string | undefined) => {
  if (!s || s === "N/A") return null;
  const n = Number(s.replace(/[,%]/g, "").split("/")[0]);
  return Number.isFinite(n) ? n : null;
};

export function parseOmdb(j: OmdbResponse): OmdbRatings {
  if (j.Response !== "True") return { imdb: null, imdbVotes: null, rottenTomatoes: null, metacritic: null };
  const rating = (source: string) => j.Ratings?.find((r) => r.Source === source)?.Value;
  return {
    imdb: num(j.imdbRating),
    imdbVotes: num(j.imdbVotes),
    rottenTomatoes: num(rating("Rotten Tomatoes")),
    metacritic: num(j.Metascore) ?? num(rating("Metacritic")),
  };
}

/** IMDb / Rotten Tomatoes / Metacritic for an IMDb id. Null when unavailable or out of budget. */
export async function getOmdbRatings(imdbId: string | null | undefined): Promise<OmdbRatings | null> {
  const key = env.omdbKey();
  if (!key || !imdbId) return null;
  try {
    return await cached(`omdb:${imdbId}`, TTL.omdb, async () => {
      if (!(await reserveQuota("omdb", 1))) throw new Error("OMDb daily budget reached");
      const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${key}`;
      return parseOmdb(await fetchJson<OmdbResponse>("OMDb", url, { timeoutMs: 8000, retries: 1 }));
    });
  } catch (err) {
    console.warn("[omdb]", err instanceof Error ? err.message : err);
    return null;
  }
}
