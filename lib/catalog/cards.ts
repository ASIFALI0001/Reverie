import { titleHref } from "@/lib/catalog/links";
import { formatRuntime } from "@/lib/format";
import type { Category, MediaType, TitleKey } from "@/lib/catalog/types";

/** Everything a poster card (or list row) needs — small enough to send in bulk. */
export type TitleCard = {
  key: TitleKey;
  mediaType: MediaType;
  tmdbId: number;
  category: Category;
  title: string;
  year: number | null;
  posterPath: string | null;
  posterBlur: string | null;
  color: string | null;
  runtime: number | null;
  seasons: number | null;
  genres: string[];
  voteAverage: number;
  href: string;
};

type CardSource = {
  _id: TitleKey;
  mediaType: MediaType;
  tmdbId: number;
  category: Category;
  title: string;
  year: number | null;
  posterPath: string | null;
  posterBlur?: string | null;
  colors?: { dominant: string } | null;
  runtime: number | null;
  seasons: number | null;
  genres: string[];
  voteAverage: number;
};

export function toCard(d: CardSource): TitleCard {
  return {
    key: d._id,
    mediaType: d.mediaType,
    tmdbId: d.tmdbId,
    category: d.category,
    title: d.title,
    year: d.year,
    posterPath: d.posterPath,
    posterBlur: d.posterBlur ?? null,
    color: d.colors?.dominant ?? null,
    runtime: d.runtime,
    seasons: d.seasons,
    genres: d.genres.slice(0, 3),
    voteAverage: d.voteAverage,
    href: titleHref(d.mediaType, d.tmdbId, d.title),
  };
}

/** Short meta for under a poster: "2h 10m" for films, "3 seasons" for series. */
export function cardMeta(c: Pick<TitleCard, "mediaType" | "runtime" | "seasons">): string | null {
  if (c.mediaType === "tv") return c.seasons ? `${c.seasons} season${c.seasons === 1 ? "" : "s"}` : null;
  return formatRuntime(c.runtime);
}
