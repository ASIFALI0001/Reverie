/**
 * Minimal sRGB ↔ OKLCH conversion (Björn Ottosson's OKLab), enough to turn a
 * poster's dominant colour into a readable page accent without a colour library.
 */
export type Oklch = { l: number; c: number; h: number };

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

export function oklchToHex(color: Oklch): string {
  // Reduce chroma until the colour fits sRGB (keeps hue and lightness honest).
  let c = color.c;
  let lin = oklchToLinear({ ...color, c });
  for (let i = 0; i < 40 && !inGamut(lin); i++) {
    c *= 0.92;
    lin = oklchToLinear({ ...color, c });
  }
  return rgbToHex(lin.map(toGamma) as [number, number, number]);
}

/**
 * Keep a colour's hue but force it into a lightness band and under a chroma
 * ceiling — poster colours become usable UI accents (no neon, no mud).
 */
export function clampAccent(hex: string, { minL, maxL, maxC, minC = 0.04 }: { minL: number; maxL: number; maxC: number; minC?: number }): string {
  const o = hexToOklch(hex);
  const l = Math.min(maxL, Math.max(minL, o.l));
  // Near-grey posters (B&W stills) stay neutral rather than inventing a hue.
  const c = o.c < 0.02 ? o.c : Math.min(maxC, Math.max(minC, o.c));
  return oklchToHex({ l, c, h: o.h });
}

/** WCAG relative luminance contrast between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(toLinear) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
