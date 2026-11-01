import "server-only";
import pLimit from "p-limit";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/sources/http";
import { cached, TTL } from "@/lib/cache/cached";
import { DETAILS_APPEND, type TmdbDetails } from "@/lib/catalog/normalize";
import type { MediaType } from "@/lib/catalog/types";

const BASE = "https://api.themoviedb.org/3";
// TMDB allows roughly 40–50 req/s; stay well under it from any one instance.
const limit = pLimit(8);

export type TmdbParams = Record<string, string | number | boolean | undefined | null>;

/** Raw TMDB v3 GET. Prefer the typed, cached helpers below. */
export function tmdb<T>(path: string, params: TmdbParams = {}): Promise<T> {
  const { token, key } = env.tmdb();
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  if (!token && key) url.searchParams.set("api_key", key);
  return limit(() =>
    fetchJson<T>("TMDB", url, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }),
  );
}

export type TmdbListItem = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  profile_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
  known_for_department?: string;
};

export type TmdbPage<T = TmdbListItem> = { page: number; results: T[]; total_pages: number; total_results: number };

// ── Details: not cached here — the normalized `titles` collection is their cache. ──
export function fetchDetails(mediaType: MediaType, id: number) {
  return tmdb<TmdbDetails>(`/${mediaType}/${id}`, { append_to_response: DETAILS_APPEND[mediaType] });
}

// ── Cached endpoints ──
export type ProviderEntry = { provider_id: number; provider_name: string; logo_path: string; display_priority: number };
export type RegionProviders = {
  link?: string;
  flatrate?: ProviderEntry[];
  free?: ProviderEntry[];
  ads?: ProviderEntry[];
  rent?: ProviderEntry[];
  buy?: ProviderEntry[];
};

export function getWatchProviders(mediaType: MediaType, id: number) {
  return cached(`tmdb:providers:${mediaType}:${id}`, TTL.providers, () =>
    tmdb<{ id: number; results: Record<string, RegionProviders> }>(`/${mediaType}/${id}/watch/providers`),
  );
}

export type RegionService = { id: number; name: string; logoPath: string | null };

/**
 * The streaming services available in a region (films and series merged), in the order TMDB
 * shows them there: for the "My services" picker. Cached for a week.
 */
export function getRegionServices(region: string) {
  return cached(`tmdb:region-services:${region}`, 7 * 24 * 3600, async () => {
    type Row = { provider_id: number; provider_name: string; logo_path: string | null; display_priorities?: Record<string, number>; display_priority?: number };
    const [movie, tv] = await Promise.all(
      (["movie", "tv"] as const).map((m) => tmdb<{ results: Row[] }>(`/watch/providers/${m}`, { watch_region: region, language: "en-US" })),
    );
    const byId = new Map<number, Row>();
    for (const r of [...movie.results, ...tv.results]) if (!byId.has(r.provider_id)) byId.set(r.provider_id, r);
    const rank = (r: Row) => r.display_priorities?.[region] ?? r.display_priority ?? 999;
    return [...byId.values()]
      .sort((a, b) => rank(a) - rank(b))
      .map((r): RegionService => ({ id: r.provider_id, name: r.provider_name, logoPath: r.logo_path }));
  });
}

export type TmdbEpisode = {
  episode_number: number;
  name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  air_date: string | null;
  runtime: number | null;
};
export type SeasonIndex = { season: number; episodes: number; airDate: string | null }[];

/** A series' seasons (specials left out), for the "where are you?" picker. Cached for a week. */
export function getSeasonIndex(tvId: number) {
  return cached(`tmdb:seasons:${tvId}`, 7 * 24 * 3600, async (): Promise<SeasonIndex> => {
    const d = await tmdb<{ seasons?: { season_number: number; episode_count: number; air_date: string | null }[] }>(`/tv/${tvId}`, { language: "en-US" });
    return (d.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({ season: s.season_number, episodes: s.episode_count, airDate: s.air_date }));
  });
}

/** One season's episodes: names, overviews and ratings. Cached for a week. */
export function getSeason(tvId: number, season: number) {
  return cached(`tmdb:season:${tvId}:${season}`, 7 * 24 * 3600, async () => {
    const d = await tmdb<{ episodes?: TmdbEpisode[] }>(`/tv/${tvId}/season/${season}`, { language: "en-US" });
    return (d.episodes ?? []).map((e) => ({
      episode_number: e.episode_number,
      name: e.name ?? "",
      overview: e.overview ?? "",
      vote_average: e.vote_average ?? 0,
      vote_count: e.vote_count ?? 0,
      air_date: e.air_date ?? null,
      runtime: e.runtime ?? null,
    }));
  });
}

export type TmdbCollection = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TmdbListItem[];
};

export function getCollection(id: number) {
  return cached(`tmdb:collection:${id}`, TTL.details, () => tmdb<TmdbCollection>(`/collection/${id}`));
}

export type TmdbPerson = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  combined_credits: {
    cast: (TmdbListItem & { character?: string; episode_count?: number })[];
    crew: (TmdbListItem & { job?: string; department?: string })[];
  };
};

export function getPerson(id: number) {
  return cached(`tmdb:person:${id}`, TTL.details, () =>
    tmdb<TmdbPerson>(`/person/${id}`, { append_to_response: "combined_credits" }),
  );
}

export function searchMulti(query: string, page = 1) {
  const q = query.trim().toLowerCase();
  return cached(`tmdb:search:${q}:${page}`, TTL.search, () =>
    tmdb<TmdbPage>("/search/multi", { query: q, page, include_adult: false }),
  );
}

export function searchTitles(query: string, mediaType: MediaType, year?: number | null) {
  const q = query.trim().toLowerCase();
  return cached(`tmdb:search:${mediaType}:${q}:${year ?? ""}`, TTL.search, () =>
    tmdb<TmdbPage>(`/search/${mediaType}`, {
      query: q,
      include_adult: false,
      ...(year ? (mediaType === "movie" ? { year } : { first_air_date_year: year }) : {}),
    }),
  );
}

export function getTrending(mediaType: "all" | MediaType = "all", window: "day" | "week" = "week", page = 1) {
  return cached(`tmdb:trending:${mediaType}:${window}:${page}`, TTL.trending, () =>
    tmdb<TmdbPage>(`/trending/${mediaType}/${window}`, { page }),
  );
}

/** Any list endpoint (popular, top_rated, discover…), cached for 6 hours by its full query. */
export function getList(path: string, params: TmdbParams = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return cached(`tmdb:list:${path}?${qs}`, TTL.list, () => tmdb<TmdbPage>(path, params));
}

export function getGenres(mediaType: MediaType) {
  return cached(`tmdb:genres:${mediaType}`, TTL.meta, () =>
    tmdb<{ genres: { id: number; name: string }[] }>(`/genre/${mediaType}/list`, { language: "en" }),
  );
}
