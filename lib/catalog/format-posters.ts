import "server-only";
import { cacheLife } from "next/cache";
import { titlesCol } from "@/lib/db/titles";
import type { Category } from "@/lib/catalog/types";
import type { FormatPosters } from "@/lib/taste/types";

const CATEGORIES: Category[] = ["movie", "series", "anime", "cartoon"];

/** The three best-known posters per format, for the onboarding tiles (cached for a day). */
export async function getFormatPosters(): Promise<FormatPosters> {
  "use cache";
  cacheLife("days");
  const out: FormatPosters = { movie: [], series: [], anime: [], cartoon: [] };
  try {
    const col = await titlesCol();
    await Promise.all(
      CATEGORIES.map(async (category) => {
        const docs = await col
          .find({ category, posterPath: { $ne: null } }, { projection: { posterPath: 1 } })
          .sort({ voteCount: -1 })
          .limit(3)
          .toArray();
        out[category] = docs.map((d) => d.posterPath!).filter(Boolean);
      }),
    );
  } catch (err) {
    console.warn("[onboarding] format posters unavailable", err);
  }
  return out;
}
