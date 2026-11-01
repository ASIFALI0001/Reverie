import { CountUp } from "@/components/motion/CountUp";
import { formatCount } from "@/lib/format";
import type { Ratings } from "@/lib/catalog/types";

type Item = { label: string; value: number; decimals: number; suffix?: string; extra?: string | null; scale?: string };

/** Only the ratings that exist, each counting up as the hero settles. */
export function RatingsStrip({ ratings, isAnime }: { ratings: Ratings; isAnime: boolean }) {
  const items: Item[] = [];
  if (ratings.imdb != null) {
    const votes = formatCount(ratings.imdbVotes);
    items.push({ label: "IMDb", value: ratings.imdb, decimals: 1, extra: votes ? `${votes} votes` : null, scale: "/10" });
  }
  if (ratings.rottenTomatoes != null) items.push({ label: "Rotten Tomatoes", value: ratings.rottenTomatoes, decimals: 0, suffix: "%" });
  if (ratings.metacritic != null) items.push({ label: "Metacritic", value: ratings.metacritic, decimals: 0 });
  if (isAnime && ratings.mal != null) items.push({ label: "MyAnimeList", value: ratings.mal, decimals: 2 });
  if (ratings.tmdb != null && ratings.tmdb > 0) items.push({ label: "TMDB", value: ratings.tmdb, decimals: 1 });
  if (items.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-hairline pt-6 [grid-area:ratings] sm:flex sm:flex-wrap">
      {items.map((r) => (
        <div key={r.label} className="min-w-[6.5rem]">
          <dt className="caption">{r.label}</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <CountUp value={r.value} decimals={r.decimals} suffix={r.suffix} delay={0.9} className="text-[1.625rem] font-light leading-none" />
            {r.extra ? <span className="text-meta text-muted">{r.extra}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
