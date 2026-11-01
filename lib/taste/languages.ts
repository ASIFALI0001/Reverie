/** Languages offered in onboarding (ISO 639-1), in the order we show them. */
export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" },
  { code: "bn", label: "Bengali" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
];

const LABEL = new Map(LANGUAGE_OPTIONS.map((l) => [l.code, l.label]));

export function languageLabel(code: string): string {
  return LABEL.get(code) ?? code.toUpperCase();
}

/** Languages people in a region commonly watch in, beyond English. Used to pre-select and to seed the deck. */
export const REGION_LANGUAGES: Record<string, string[]> = {
  IN: ["hi", "ta", "te", "ml"],
  JP: ["ja"],
  KR: ["ko"],
  CN: ["zh"],
  TW: ["zh"],
  HK: ["zh"],
  ES: ["es"],
  MX: ["es"],
  AR: ["es"],
  FR: ["fr"],
  DE: ["de"],
  IT: ["it"],
  BD: ["bn"],
};
