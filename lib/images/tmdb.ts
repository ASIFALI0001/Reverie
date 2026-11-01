export type TmdbImageKind = "poster" | "backdrop" | "profile" | "logo" | "still" | "thumb";

/** Build a next/image src for a TMDB file path ("/abc.jpg"); see lib/images/loader.ts. */
export function tmdbImg(path: string | null | undefined, kind: TmdbImageKind = "poster"): string | null {
  if (!path) return null;
  return `/tmdb/${kind}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL at a fixed size (for OG images, emails, structured data). */
export function tmdbImgUrl(path: string | null | undefined, size = "w500"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : `/${path}`}`;
}
