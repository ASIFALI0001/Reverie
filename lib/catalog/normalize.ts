import { categorize } from "@/lib/catalog/category";
import { detectAnimeTags, detectFranchises } from "@/lib/catalog/franchises";
import { titleKey, type MediaType, type Person, type TitleCore, type TitleKey, type TitleReview, type TitleVideo } from "@/lib/catalog/types";

/** The subset of TMDB's movie/TV details (with append_to_response) that we read. */
export type TmdbDetails = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number | null } | null;
  next_episode_to_air?: { runtime?: number | null } | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  genres?: { id: number; name: string }[];
  keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
  belongs_to_collection?: { id: number; name: string; poster_path: string | null; backdrop_path: string | null } | null;
  production_companies?: { id: number; name: string }[];
  networks?: { id: number; name: string }[];
  origin_country?: string[];
  production_countries?: { iso_3166_1: string }[];
  original_language?: string;
  spoken_languages?: { iso_639_1: string }[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
  credits?: { cast?: TmdbCast[]; crew?: TmdbCrew[] };
  aggregate_credits?: { cast?: TmdbAggCast[]; crew?: TmdbCrew[] };
  overview?: string;
  tagline?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string; type: number }[] }[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  external_ids?: { imdb_id?: string | null };
  homepage?: string | null;
  videos?: { results: { key: string; name: string; site: string; type: string; official: boolean; published_at?: string }[] };
  reviews?: { results: { author: string; author_details?: { rating?: number | null }; content: string; url: string; created_at?: string }[] };
  recommendations?: { results: { id: number; media_type?: string }[] };
  similar?: { results: { id: number; media_type?: string }[] };
};

type TmdbCast = { id: number; name: string; character?: string; profile_path: string | null; order?: number };
type TmdbAggCast = { id: number; name: string; profile_path: string | null; roles?: { character: string }[]; total_episode_count?: number };
type TmdbCrew = { id: number; name: string; job?: string; jobs?: { job: string }[]; profile_path: string | null };

const MAX_CAST = 12;
const MAX_KEYWORDS = 40;

function yearOf(date?: string | null): number | null {
  const y = Number(date?.slice(0, 4));
  return Number.isFinite(y) && y > 1870 ? y : null;
}

/** Prefer theatrical certifications (types 3/2), fall back to anything non-empty. */
function certifications(d: TmdbDetails, mediaType: MediaType): Record<string, string> {
  const out: Record<string, string> = {};
  if (mediaType === "movie") {
    for (const r of d.release_dates?.results ?? []) {
      const ranked = [...r.release_dates].sort((a, b) => rankType(a.type) - rankType(b.type));
      const cert = ranked.find((x) => x.certification?.trim())?.certification.trim();
      if (cert) out[r.iso_3166_1] = cert;
    }
  } else {
    for (const r of d.content_ratings?.results ?? []) if (r.rating?.trim()) out[r.iso_3166_1] = r.rating.trim();
  }
  return out;
}

const rankType = (t: number) => ({ 3: 0, 2: 1, 4: 2, 1: 3, 5: 4, 6: 5 })[t] ?? 9;

/** Trim at a sentence boundary so excerpts never end mid-word. */
export function excerpt(text: string, max = 420): string {
  const clean = text.replace(/\s+/g, " ").replace(/[*_#>]/g, "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function keysFrom(list: { id: number; media_type?: string }[] | undefined, fallback: MediaType): TitleKey[] {
  return (list ?? [])
    .filter((r) => !r.media_type || r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 20)
    .map((r) => titleKey((r.media_type as MediaType) ?? fallback, r.id));
}

export function normalizeTmdb(d: TmdbDetails, mediaType: MediaType): TitleCore {
  const releaseDate = (mediaType === "movie" ? d.release_date : d.first_air_date) || null;
  const genres = d.genres ?? [];
  const kw = (mediaType === "movie" ? d.keywords?.keywords : d.keywords?.results) ?? [];
  const originCountry = d.origin_country?.length ? d.origin_country : (d.production_countries ?? []).map((c) => c.iso_3166_1);
  const originalLanguage = d.original_language ?? "en";
  const genreIds = genres.map((g) => g.id);
  const keywordIds = kw.map((k) => k.id);
  const companies = (d.production_companies ?? []).map(({ id, name }) => ({ id, name }));
  const category = categorize({ mediaType, genreIds, originCountry, originalLanguage });

  const crew = d.credits?.crew ?? d.aggregate_credits?.crew ?? [];
  const jobOf = (c: TmdbCrew) => c.job ?? c.jobs?.[0]?.job ?? null;
  const person = (c: { id: number; name: string; profile_path: string | null }, extra: Partial<Person> = {}): Person => ({
    id: c.id,
    name: c.name,
    profilePath: c.profile_path ?? null,
    ...extra,
  });
  const uniq = (people: Person[]) => people.filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i);

  const directors = uniq(crew.filter((c) => jobOf(c) === "Director").map((c) => person(c, { job: "Director" }))).slice(0, 3);
  const writers = uniq(
    crew.filter((c) => ["Screenplay", "Writer", "Story", "Novel"].includes(jobOf(c) ?? "")).map((c) => person(c, { job: jobOf(c) })),
  ).slice(0, 3);
  const creators = (d.created_by ?? []).map((c) => person(c, { job: "Creator" }));

  const topCast: Person[] =
    mediaType === "movie"
      ? (d.credits?.cast ?? []).slice(0, MAX_CAST).map((c) => person(c, { character: c.character ?? null }))
      : (d.aggregate_credits?.cast ?? []).slice(0, MAX_CAST).map((c) => person(c, { character: c.roles?.[0]?.character ?? null }));

  const runtime =
    mediaType === "movie"
      ? d.runtime || null
      : d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || d.next_episode_to_air?.runtime || null;

  const videos: TitleVideo[] = (d.videos?.results ?? [])
    .filter((v) => v.site === "YouTube" && ["Trailer", "Teaser", "Clip", "Featurette", "Opening Credits"].includes(v.type))
    .sort((a, b) => Number(b.official) - Number(a.official) || (a.type === "Trailer" ? -1 : 1))
    .slice(0, 10)
    .map((v) => ({ key: v.key, name: v.name, type: v.type, official: v.official, publishedAt: v.published_at ?? null }));

  const reviews: TitleReview[] = (d.reviews?.results ?? [])
    .filter((r) => r.content?.trim().length > 80)
    .slice(0, 3)
    .map((r) => ({
      author: r.author,
      rating: r.author_details?.rating ?? null,
      excerpt: excerpt(r.content),
      url: r.url,
      createdAt: r.created_at ?? null,
    }));

  const collection = d.belongs_to_collection
    ? {
        id: d.belongs_to_collection.id,
        name: d.belongs_to_collection.name,
        posterPath: d.belongs_to_collection.poster_path ?? null,
        backdropPath: d.belongs_to_collection.backdrop_path ?? null,
      }
    : null;

  return {
    key: titleKey(mediaType, d.id),
    tmdbId: d.id,
    mediaType,
    category,
    title: (mediaType === "movie" ? d.title : d.name) ?? d.title ?? d.name ?? "Untitled",
    originalTitle: (mediaType === "movie" ? d.original_title : d.original_name) ?? "",
    year: yearOf(releaseDate),
    releaseDate,
    runtime,
    seasons: mediaType === "tv" ? (d.number_of_seasons ?? null) : null,
    episodes: mediaType === "tv" ? (d.number_of_episodes ?? null) : null,
    status: d.status ?? null,
    genres: genres.map((g) => g.name),
    genreIds,
    keywords: kw.slice(0, MAX_KEYWORDS).map((k) => k.name),
    keywordIds: keywordIds.slice(0, MAX_KEYWORDS),
    collection,
    companies,
    networks: (d.networks ?? []).map(({ id, name }) => ({ id, name })),
    originCountry,
    originalLanguage,
    spokenLanguages: (d.spoken_languages ?? []).map((l) => l.iso_639_1),
    directors,
    creators,
    writers,
    topCast,
    overview: d.overview?.trim() ?? "",
    tagline: d.tagline?.trim() ?? "",
    posterPath: d.poster_path ?? null,
    backdropPath: d.backdrop_path ?? null,
    popularity: d.popularity ?? 0,
    voteCount: d.vote_count ?? 0,
    voteAverage: d.vote_average ?? 0,
    certification: certifications(d, mediaType),
    imdbId: d.external_ids?.imdb_id || null,
    homepage: d.homepage || null,
    franchises: detectFranchises({ companyIds: companies.map((c) => c.id), collectionId: collection?.id ?? null, keywordIds }),
    animeTags: category === "anime" ? detectAnimeTags(keywordIds) : [],
    videos,
    reviews,
    tmdbRecs: keysFrom(d.recommendations?.results, mediaType),
    tmdbSimilar: keysFrom(d.similar?.results, mediaType),
  };
}

/** Append string for the details call; one request per title covers everything above. */
export const DETAILS_APPEND: Record<MediaType, string> = {
  movie: "credits,keywords,external_ids,release_dates,videos,recommendations,similar,reviews",
  tv: "aggregate_credits,keywords,external_ids,content_ratings,videos,recommendations,similar,reviews",
};
