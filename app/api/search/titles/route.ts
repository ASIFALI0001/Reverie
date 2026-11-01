import { z } from "zod";
import { route } from "@/lib/http/route";
import { searchMulti } from "@/lib/sources/tmdb";
import { categorize } from "@/lib/catalog/category";
import { titleHref } from "@/lib/catalog/links";
import { titleKey } from "@/lib/catalog/types";
import { foldDiacritics } from "@/lib/format";
import type { TitleHit } from "@/lib/search/types";

const Input = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

const norm = (s: string) => foldDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * GET /api/search/titles?q=iron — instant title lookup over TMDB (cached).
 * TMDB's relevance order, nudged so exact and prefix matches of well-known
 * titles come first ("dune" → Dune (2021) before a 1984 short of the same name).
 */
export const GET = route(
  { auth: "optional", input: Input, rateLimit: { name: "title-search", limit: 90, windowSec: 60 } },
  async ({ input }) => {
    const q = norm(input.q);
    const page = await searchMulti(input.q);
    const scored = page.results
      .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path && !r.adult)
      .map((r, i) => {
        const mediaType = r.media_type as "movie" | "tv";
        const title = r.title ?? r.name ?? "";
        const date = r.release_date || r.first_air_date || "";
        const t = norm(title);
        const votes = r.vote_count ?? 0;
        // A prefix only counts for titles people know ("se7en" shouldn't surface "Se7en Green Bottles").
        const textScore = t === q ? 3 : t.startsWith(q) && votes >= 50 ? 1.2 : 0;
        const hit: TitleHit = {
          key: titleKey(mediaType, r.id),
          mediaType,
          tmdbId: r.id,
          title,
          year: date ? Number(date.slice(0, 4)) : null,
          category: categorize({
            mediaType,
            genreIds: r.genre_ids ?? [],
            originCountry: r.origin_country ?? [],
            originalLanguage: r.original_language ?? "",
          }),
          posterPath: r.poster_path,
          href: titleHref(mediaType, r.id, title),
        };
        return { hit, votes, score: textScore + 0.8 * Math.log10(votes + 1) - 0.05 * i };
      });
    // Near-zero-vote entries are mostly noise; drop them when there's enough solid material.
    const solid = scored.filter((s) => s.votes >= 5);
    const pool = solid.length >= 4 ? solid : scored;
    pool.sort((a, b) => b.score - a.score);
    return { results: pool.slice(0, input.limit).map((s) => s.hit) };
  },
);
