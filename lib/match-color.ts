import { clamp } from "@/lib/format";
import { hexToOklch, oklchToHex, type Oklch } from "@/lib/color/oklch";

/**
 * Match colour is a colour-temperature scale, not decoration: daylight steel
 * (≈6500K) for weak matches warming to tungsten (≈3200K) for strong ones.
 * It deliberately ignores per-page poster tints so its meaning never shifts.
 */
export function warmth(value: number): number {
  // Below ~35 reads fully "daylight", above ~90 fully "tungsten"; eased in between.
  const t = clamp((value - 35) / 55, 0, 1);
  return t * t * (3 - 2 * t);
}

export function matchColor(value: number): string {
  const w = Math.round(warmth(value) * 100);
  // Mix in OKLab, not OKLCH: a straight line through the neutral axis, so the
  // midpoint is warm-white light instead of a hue rotation through green.
  return `color-mix(in oklab, var(--color-daylight) ${100 - w}%, var(--color-accent))`;
}

/** Dark-theme tokens, for places CSS can't reach (OG images). */
const DAYLIGHT: Oklch = { l: 0.72, c: 0.045, h: 238 };
const TUNGSTEN = hexToOklch("#e8a23a");

/** The same OKLab mix as `matchColor`, resolved to a hex for renderers without CSS variables. */
export function matchColorHex(value: number): string {
  const w = warmth(value);
  const lab = (o: Oklch) => [o.l, o.c * Math.cos((o.h * Math.PI) / 180), o.c * Math.sin((o.h * Math.PI) / 180)] as const;
  const [l1, a1, b1] = lab(DAYLIGHT);
  const [l2, a2, b2] = lab(TUNGSTEN);
  const l = l1 + (l2 - l1) * w;
  const a = a1 + (a2 - a1) * w;
  const b = b1 + (b2 - b1) * w;
  return oklchToHex({ l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 });
}
