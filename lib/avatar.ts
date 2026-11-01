/** Monogram tints — muted so they sit with the palette rather than shout over posters. */
export const TINT_HEX = {
  tungsten: "#e8a23a",
  daylight: "#93a9be",
  sepia: "#b8946a",
  rose: "#c98a80",
  sage: "#93aa8c",
  plum: "#9c7b98",
} as const;

export type AvatarTint = keyof typeof TINT_HEX;
export const AVATAR_TINTS = Object.keys(TINT_HEX) as AvatarTint[];

export function isAvatarTint(v: string): v is AvatarTint {
  return v in TINT_HEX;
}
