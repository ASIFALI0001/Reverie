import { slugify } from "@/lib/format";
import type { MediaType } from "@/lib/catalog/types";

/** Canonical title URL: /title/movie/68721-iron-man-3 */
export function titleHref(mediaType: MediaType, tmdbId: number, title: string): string {
  const slug = slugify(title);
  return `/title/${mediaType}/${tmdbId}${slug ? `-${slug}` : ""}`;
}

export function titleSlug(tmdbId: number, title: string) {
  const slug = slugify(title);
  return `${tmdbId}${slug ? `-${slug}` : ""}`;
}

/** "68721-iron-man-3" → 68721 (null when the slug doesn't start with an id). */
export function idFromSlug(slug: string): number | null {
  const m = /^(\d+)(?:-|$)/.exec(slug);
  return m ? Number(m[1]) : null;
}

export function isMediaType(v: string): v is MediaType {
  return v === "movie" || v === "tv";
}
