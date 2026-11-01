import type { TitleKey } from "@/lib/catalog/types";

/**
 * The /taste numbers beyond counts (pure, unit-tested): the genre you watch most, your
 * highest-rated title, your favourite director and your longest binge, plus the top three a
 * share card shows. Dropped titles don't count towards any of them.
 */

export type StatItem = {
  key: string;
  status: string;
  rating: number | null;
  watchedAt: Date | null;
  addedAt: Date;
};

export type StatTitle = {
  title: string;
  mediaType: "movie" | "tv";
  genres: string[];
  directors: { id: number; name: string }[];
  episodes: number | null;
  /** Minutes: a film's runtime, or a typical episode. */
  runtime: number | null;
  posterPath?: string | null;
};

export type TasteHighlights = {
  topGenre: { name: string; titles: number } | null;
  highestRated: { key: TitleKey; title: string; rating: number } | null;
  /** Needs two titles by them that you didn't rate below 6: one film isn't a favourite yet. */
  director: { name: string; titles: number } | null;
  /** The longest series you finished. */
  binge: { key: TitleKey; title: string; episodes: number; hours: number | null } | null;
};

const when = (i: StatItem) => new Date(i.watchedAt ?? i.addedAt).getTime();
const byName = (a: string, b: string) => a.localeCompare(b);

export function highlights(items: StatItem[], titles: Map<string, StatTitle>): TasteHighlights {
  const kept = items.filter((i) => i.status !== "dropped" && titles.has(i.key));

  const genres = new Map<string, number>();
  for (const i of kept) for (const g of titles.get(i.key)!.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
  const [genre] = [...genres.entries()].sort((a, b) => b[1] - a[1] || byName(a[0], b[0]));

  const [best] = kept.filter((i) => i.rating != null).sort((a, b) => b.rating! - a.rating! || when(b) - when(a));

  const directors = new Map<number, { name: string; titles: number; ratings: number[] }>();
  for (const i of kept) {
    if (i.rating != null && i.rating < 6) continue;
    for (const d of titles.get(i.key)!.directors) {
      const e = directors.get(d.id) ?? { name: d.name, titles: 0, ratings: [] };
      e.titles++;
      if (i.rating != null) e.ratings.push(i.rating);
      directors.set(d.id, e);
    }
  }
  const mean = (r: number[]) => (r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0);
  const [director] = [...directors.values()].filter((d) => d.titles >= 2).sort((a, b) => b.titles - a.titles || mean(b.ratings) - mean(a.ratings) || byName(a.name, b.name));

  const series = kept
    .filter((i) => i.status === "watched")
    .map((i) => ({ i, t: titles.get(i.key)! }))
    .filter(({ t }) => t.mediaType === "tv" && (t.episodes ?? 0) >= 2);
  const [binge] = series.sort((a, b) => b.t.episodes! - a.t.episodes! || (b.t.runtime ?? 0) - (a.t.runtime ?? 0));

  return {
    topGenre: genre ? { name: genre[0], titles: genre[1] } : null,
    highestRated: best ? { key: best.key as TitleKey, title: titles.get(best.key)!.title, rating: best.rating! } : null,
    director: director ? { name: director.name, titles: director.titles } : null,
    binge: binge
      ? {
          key: binge.i.key as TitleKey,
          title: binge.t.title,
          episodes: binge.t.episodes!,
          hours: binge.t.runtime ? Math.round((binge.t.runtime * binge.t.episodes!) / 60) : null,
        }
      : null,
  };
}

/** Your highest-rated titles with a poster, best first (newest first among equals). */
export function topRated(items: StatItem[], titles: Map<string, StatTitle>, n = 3): { key: TitleKey; title: string; posterPath: string; rating: number }[] {
  return items
    .filter((i) => i.status !== "dropped" && i.rating != null && titles.get(i.key)?.posterPath)
    .sort((a, b) => b.rating! - a.rating! || when(b) - when(a))
    .slice(0, n)
    .map((i) => {
      const t = titles.get(i.key)!;
      return { key: i.key as TitleKey, title: t.title, posterPath: t.posterPath!, rating: i.rating! };
    });
}
