import "server-only";
import sharp from "sharp";
import { Vibrant } from "node-vibrant/node";
import { clampAccent } from "@/lib/color/oklch";
import { fetchWithTimeout } from "@/lib/sources/http";

export type PosterPalette = {
  /** The poster's characteristic colour, untouched. */
  dominant: string;
  /** Readable accent on the dark theme (OKLCH L≈0.74). */
  accentDark: string;
  /** Readable accent on the light theme (OKLCH L≈0.47). */
  accentLight: string;
  /** 8×12 WebP data URL for next/image's blur placeholder. */
  blur: string;
};

/** Dominant colour + accents + blur placeholder from the w185 poster. Null if the image can't be read. */
export async function posterPalette(posterPath: string | null): Promise<PosterPalette | null> {
  if (!posterPath) return null;
  try {
    const res = await fetchWithTimeout(`https://image.tmdb.org/t/p/w185${posterPath}`, 10_000);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const [palette, blurBuf] = await Promise.all([
      Vibrant.from(buf).getPalette(),
      sharp(buf).resize(8, 12, { fit: "cover" }).webp({ quality: 45 }).toBuffer(),
    ]);
    // Prefer a lively swatch with real presence on the poster; fall back through calmer ones.
    const pick =
      [palette.Vibrant, palette.Muted, palette.DarkVibrant, palette.LightVibrant, palette.DarkMuted]
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .sort((a, b) => b.population - a.population)
        .find((s, i, arr) => s.population >= (arr[0]?.population ?? 0) * 0.25) ?? palette.Vibrant;
    const dominant = pick?.hex ?? "#8a8378";
    return {
      dominant,
      accentDark: clampAccent(dominant, { minL: 0.7, maxL: 0.8, maxC: 0.15 }),
      accentLight: clampAccent(dominant, { minL: 0.42, maxL: 0.52, maxC: 0.14 }),
      blur: `data:image/webp;base64,${blurBuf.toString("base64")}`,
    };
  } catch (err) {
    console.warn("[colors]", posterPath, err instanceof Error ? err.message : err);
    return null;
  }
}
