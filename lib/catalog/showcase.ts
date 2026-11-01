import "server-only";
import { cacheLife } from "next/cache";
import { tmdb, type TmdbPage } from "@/lib/sources/tmdb";

export type ShowcasePoster = { id: number; mediaType: "movie" | "tv"; title: string; posterPath: string };

/**
 * A day-cached mix of trending and acclaimed posters for decorative walls (auth pages, landing).
 * Either list alone still makes a wall: when TMDB fails one of them, the wall is built from the
 * other and kept for hours; when it fails both, the empty wall is kept for minutes only. So a
 * flaky connection during a build doesn't leave the landing page bare (or half-mixed) for days.
 */
export async function getShowcasePosters(count = 30): Promise<ShowcasePoster[]> {
  "use cache";
  const settled = await Promise.allSettled([tmdb<TmdbPage>("/trending/all/week"), tmdb<TmdbPage>("/movie/top_rated", { page: 1 })]);
  const lists = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value.results] : []));
  const failed = settled.flatMap((s) => (s.status === "rejected" ? [s.reason] : []));
  if (failed.length) console.warn(`[showcase] TMDB: ${failed.length} of ${settled.length} poster lists unavailable${lists.length ? "" : ", rendering without posters"}`, failed[0]);

  const seen = new Set<string>();
  const out: ShowcasePoster[] = [];
  // Interleave so neither list dominates a column.
  for (let i = 0; out.length < count && i < 20; i++) {
    for (const list of lists) {
      const r = list[i];
      if (!r?.poster_path || r.adult || r.media_type === "person") continue;
      const mediaType = r.media_type === "tv" || (!r.title && r.name) ? "tv" : "movie";
      const key = `${mediaType}:${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: r.id, mediaType, title: r.title ?? r.name ?? "", posterPath: r.poster_path });
    }
  }
  if (!failed.length) cacheLife("days");
  else if (lists.length) cacheLife("hours");
  else cacheLife("minutes");
  return out.slice(0, count);
}
