import { tmdbImgUrl } from "@/lib/images/tmdb";
import type { TitlePageData } from "@/lib/title-page";

// Built from a char code so the escape survives every editor and tool untouched.
const ESCAPED_LT = `${String.fromCharCode(92)}u003c`;

/** schema.org Movie / TVSeries for search engines. */
export function TitleJsonLd({ data, url }: { data: TitlePageData; url: string }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": data.mediaType === "movie" ? "Movie" : "TVSeries",
    name: data.title,
    url,
    image: tmdbImgUrl(data.posterPath),
    description: data.overview || undefined,
    datePublished: data.releaseDate ?? undefined,
    genre: data.genres,
    ...(data.mediaType === "movie" && data.runtime ? { duration: `PT${data.runtime}M` } : {}),
    ...(data.mediaType === "tv" && data.seasons ? { numberOfSeasons: data.seasons } : {}),
    director: data.directors.map((p) => ({ "@type": "Person", name: p.name })),
    actor: data.topCast.slice(0, 6).map((p) => ({ "@type": "Person", name: p.name })),
    ...(data.ratings.imdb != null && data.ratings.imdbVotes
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: data.ratings.imdb, bestRating: 10, ratingCount: data.ratings.imdbVotes } }
      : {}),
    sameAs: data.imdbId ? [`https://www.imdb.com/title/${data.imdbId}/`] : undefined,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replaceAll("<", ESCAPED_LT) }} />;
}
