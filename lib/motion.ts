/**
 * Motion tokens — the single source for timing across Motion, GSAP and CSS.
 * CSS mirrors live in app/globals.css (--ease-out, --dur-*).
 */

export const ease = {
  /** Expo-out: the house ease. Things arrive fast and settle slowly. */
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
} as const;

/** GSAP accepts CustomEase strings; these are the closest built-ins. */
export const gsapEase = {
  out: "expo.out",
  inOut: "power3.inOut",
} as const;

export const spring = {
  soft: { type: "spring", stiffness: 180, damping: 24 } as const,
  snappy: { type: "spring", stiffness: 400, damping: 30 } as const,
} as const;

/** Durations in seconds (Motion/GSAP units). */
export const duration = {
  micro: 0.15,
  small: 0.3,
  medium: 0.6,
  large: 1,
} as const;

/** Stagger between siblings, in seconds (40–60ms band). */
export const stagger = {
  tight: 0.04,
  base: 0.05,
  loose: 0.06,
} as const;

export const transition = {
  out: (d: number = duration.medium, delay = 0) => ({ duration: d, ease: ease.out, delay }),
  inOut: (d: number = duration.medium, delay = 0) => ({ duration: d, ease: ease.inOut, delay }),
} as const;
