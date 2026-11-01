import type { Category, MediaType } from "@/lib/catalog/types";

/** TMDB uses 16 for Animation in both the movie and TV genre lists. */
export const ANIMATION_GENRE_ID = 16;

type CategoryInput = {
  mediaType: MediaType;
  genreIds: number[];
  originCountry: string[];
  originalLanguage: string;
};

/**
 * The library's top-level split (brief §5.1):
 *  anime   = Animation and (Japanese origin or Japanese original language)
 *  cartoon = Animation, not anime (Pixar, Avatar: TLA, donghua…)
 *  series  = TV, not animation
 *  movie   = everything else
 */
export function categorize({ mediaType, genreIds, originCountry, originalLanguage }: CategoryInput): Category {
  if (genreIds.includes(ANIMATION_GENRE_ID)) {
    const japanese = originalLanguage === "ja" || originCountry.includes("JP");
    return japanese ? "anime" : "cartoon";
  }
  return mediaType === "tv" ? "series" : "movie";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  cartoon: "Cartoons",
};

/** One of them: "Movie", "Series" (not "Serie"), "Anime", "Cartoon". */
export const CATEGORY_SINGULAR: Record<Category, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  cartoon: "Cartoon",
};
