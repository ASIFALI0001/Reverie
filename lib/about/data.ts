import "server-only";
import { cacheLife } from "next/cache";
import { ensureTitles } from "@/lib/catalog/ensure";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import type { TitleKey } from "@/lib/catalog/types";
import { CAST } from "@/lib/about/cast";
import { getSeason, getSeasonIndex, getWatchProviders } from "@/lib/sources/tmdb";
import { env } from "@/lib/env";

/**
 * Everything the About story shows, read once a day from the real catalog: posters, tints,
 * ratings, trailers, a real series' episode ratings and real providers. Nothing is mocked except
 * the people (the friends and twins in the story are illustrations, and say so).
 */

export type AboutTitle = TitleCard & {
  backdropPath: string | null;
  tint: { dark: string; light: string } | null;
  ratings: { imdb: number | null; rottenTomatoes: number | null; metacritic: number | null } | null;
  videos: { key: string; name: string; type: string }[];
};


export type AboutData = {
  /** Every featured poster, for the opening wall and the problem's endless rows. */
  wall: { key: string; title: string; posterPath: string }[];
  titles: Record<string, AboutTitle>;
  series: { season: number; avg: number | null; episodes: { episode: number; rating: number | null }[] }[];
  providers: { region: string; title: string; stream: Provider[]; rent: Provider[]; buy: Provider[] };
};
type Provider = { name: string; logoPath: string };

function allKeys(): TitleKey[] {
  const out = new Set<TitleKey>();
  const walk = (v: unknown) => {
    if (typeof v === "string") out.add(v as TitleKey);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(CAST);
  return [...out];
}

/**
 * The story's data, cached for days. If TMDB or the catalog fails (it happens during builds),
 * the page renders its words without the posters and tries again within minutes.
 */
export async function getAboutData(): Promise<AboutData | null> {
  "use cache";
  try {
    const data = await load();
    cacheLife("days");
    return data;
  } catch (err) {
    console.warn("[about] story data unavailable, rendering the words only:", err instanceof Error ? err.message : err);
    cacheLife("minutes");
    return null;
  }
}

async function load(): Promise<AboutData> {
  const region = env.defaultRegion();
  const [docs, index, providers] = await Promise.all([
    ensureTitles(allKeys(), { enrich: false, jikan: false }),
    getSeasonIndex(1396),
    getWatchProviders("movie", 157336),
  ]);
  const titles: Record<string, AboutTitle> = {};
  for (const [key, d] of docs) {
    if (!d.posterPath) continue;
    titles[key] = {
      ...toCard(d),
      backdropPath: d.backdropPath ?? null,
      tint: d.colors ? { dark: d.colors.accentDark, light: d.colors.accentLight } : null,
      ratings: d.ratings ? { imdb: d.ratings.imdb ?? null, rottenTomatoes: d.ratings.rottenTomatoes ?? null, metacritic: d.ratings.metacritic ?? null } : null,
      // Stored videos are YouTube's already (lib/catalog/normalize.ts keeps only those).
      videos: (d.videos ?? []).slice(0, 8).map((v) => ({ key: v.key, name: v.name, type: v.type })),
    };
  }
  // A whole show is too much to read; the first five seasons tell the story.
  const seasons = await Promise.all(index.slice(0, 5).map(async (s) => ({ season: s.season, eps: await getSeason(1396, s.season) })));
  const series = seasons.map((s) => {
    const rated = s.eps.filter((e) => e.vote_count >= 5 && e.vote_average > 0);
    return {
      season: s.season,
      avg: rated.length ? Math.round((rated.reduce((a, e) => a + e.vote_average, 0) / rated.length) * 10) / 10 : null,
      episodes: s.eps.map((e) => ({ episode: e.episode_number, rating: e.vote_count >= 5 && e.vote_average > 0 ? Math.round(e.vote_average * 10) / 10 : null })),
    };
  });
  const here = providers.results?.[region] ?? providers.results?.US ?? {};
  const list = (xs?: { provider_name: string; logo_path: string }[]) => (xs ?? []).slice(0, 5).map((p) => ({ name: p.provider_name, logoPath: p.logo_path }));
  if (Object.keys(titles).length < 20) throw new Error("too few of the story's titles loaded");
  return {
    wall: Object.values(titles).map((t) => ({ key: t.key, title: t.title, posterPath: t.posterPath! })),
    titles,
    series,
    providers: { region: providers.results?.[region] ? region : "US", title: titles[CAST.match]?.title ?? "Interstellar", stream: list(here.flatrate), rent: list(here.rent), buy: list(here.buy) },
  };
}
