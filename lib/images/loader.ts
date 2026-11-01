/**
 * next/image loader. TMDB already serves fixed sizes, so instead of running images
 * through an optimizer we map each requested width to the nearest TMDB size —
 * srcset/sizes still work, with no optimization quota spent.
 *
 *   src "/tmdb/poster/abc.jpg"  →  https://image.tmdb.org/t/p/w342/abc.jpg
 *   anything else (local /public files) passes through untouched.
 */
const TMDB_SIZES: Record<string, number[]> = {
  poster: [92, 154, 185, 342, 500, 780],
  backdrop: [300, 780, 1280],
  profile: [45, 185],
  logo: [45, 92, 154, 185, 300, 500],
  still: [92, 185, 300],
  // Small poster tiles: never escalate to "original", however wide the srcset asks.
  thumb: [92, 154, 185],
};

const CAPPED = new Set(["thumb", "profile", "logo"]);

export default function reverieLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/tmdb/")) {
    const [, , kind = "poster", ...rest] = src.split("/");
    const file = rest.join("/");
    const sizes = TMDB_SIZES[kind] ?? TMDB_SIZES.poster!;
    const size = sizes.find((s) => s >= width) ?? (CAPPED.has(kind) ? sizes[sizes.length - 1] : undefined);
    return `https://image.tmdb.org/t/p/${size ? `w${size}` : "original"}/${file}`;
  }
  // Static assets: the width param is ignored by the file server but keeps next/image's contract.
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
