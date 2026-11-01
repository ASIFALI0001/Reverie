import "server-only";
import { cacheLife } from "next/cache";
import { tmdb } from "@/lib/sources/tmdb";

export type WatchRegion = { code: string; name: string };

const FALLBACK: WatchRegion[] = [
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "ES", name: "Spain" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

/** Countries TMDB has where-to-watch data for. Changes rarely; cached for a week. */
export async function getWatchRegions(): Promise<WatchRegion[]> {
  "use cache";
  cacheLife("weeks");
  try {
    const r = await tmdb<{ results: { iso_3166_1: string; english_name: string }[] }>("/watch/providers/regions", {
      language: "en-US",
    });
    return r.results
      .map((x) => ({ code: x.iso_3166_1, name: x.english_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return FALLBACK;
  }
}
