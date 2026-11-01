export type MediaType = "movie" | "tv";
export type Category = "movie" | "series" | "anime" | "cartoon";
/** Stable internal id: TMDB movie and TV ids overlap, so the media type is part of the key. */
export type TitleKey = `${MediaType}:${number}`;

export function titleKey(mediaType: MediaType, tmdbId: number): TitleKey {
  return `${mediaType}:${tmdbId}`;
}

export function parseTitleKey(key: string): { mediaType: MediaType; tmdbId: number } | null {
  const m = /^(movie|tv):(\d+)$/.exec(key);
  return m ? { mediaType: m[1] as MediaType, tmdbId: Number(m[2]) } : null;
}

export type Person = {
  id: number;
  name: string;
  character?: string | null;
  job?: string | null;
  profilePath: string | null;
};

export type Vibe = {
  summary: string;
  /** 0 = slow-burn … 1 = fast and loud */
  pace: number;
  /** 0 = light … 1 = dark */
  tone: number;
  /** 0 = easy watch … 1 = make me think */
  complexity: number;
  themes: string[];
  mood: string[];
};

export type Ratings = {
  imdb: number | null;
  imdbVotes: number | null;
  rottenTomatoes: number | null;
  metacritic: number | null;
  tmdb: number | null;
  tmdbVotes: number | null;
  mal: number | null;
};

export type TitleVideo = { key: string; name: string; type: string; official: boolean; publishedAt: string | null };
export type TitleReview = { author: string; rating: number | null; excerpt: string; url: string; createdAt: string | null };

/** Everything we derive from TMDB for one title (before AI enrichment). */
export type TitleCore = {
  key: TitleKey;
  tmdbId: number;
  mediaType: MediaType;
  category: Category;
  title: string;
  originalTitle: string;
  year: number | null;
  releaseDate: string | null;
  /** Minutes: the film's runtime, or a typical episode for series. */
  runtime: number | null;
  seasons: number | null;
  episodes: number | null;
  status: string | null;
  genres: string[];
  genreIds: number[];
  keywords: string[];
  keywordIds: number[];
  collection: { id: number; name: string; posterPath: string | null; backdropPath: string | null } | null;
  companies: { id: number; name: string }[];
  networks: { id: number; name: string }[];
  originCountry: string[];
  originalLanguage: string;
  spokenLanguages: string[];
  directors: Person[];
  creators: Person[];
  writers: Person[];
  topCast: Person[];
  overview: string;
  tagline: string;
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
  voteCount: number;
  voteAverage: number;
  certification: Record<string, string>;
  imdbId: string | null;
  homepage: string | null;
  franchises: string[];
  animeTags: string[];
  videos: TitleVideo[];
  reviews: TitleReview[];
  tmdbRecs: TitleKey[];
  tmdbSimilar: TitleKey[];
};
