import { CATEGORY_LABEL } from "@/lib/catalog/category";
import { knownChips } from "@/lib/taste/chips";
import { languageLabel } from "@/lib/taste/languages";
import type { Ending, TasteAnswers } from "@/lib/taste/types";

/** Onboarding answers in words: for the Gemini prompt, and as the query behind the answer vector. */

type Scale = { lo: string; hi: string };
export const SCALES: Record<"pace" | "tone" | "complexity" | "era", Scale> = {
  pace: { lo: "slow-burn", hi: "fast and loud" },
  tone: { lo: "light", hi: "dark" },
  complexity: { lo: "easy watching", hi: "films that make you think" },
  era: { lo: "new releases", hi: "classics" },
};

export function leaning(v: number, { lo, hi }: Scale): string {
  if (v <= 0.2) return `strongly prefers ${lo}`;
  if (v <= 0.4) return `leans ${lo}`;
  if (v < 0.6) return `no strong preference between ${lo} and ${hi}`;
  if (v < 0.8) return `leans ${hi}`;
  return `strongly prefers ${hi}`;
}

const ENDING: Record<Ending, string> = {
  happy: "prefers happy endings",
  ambiguous: "likes ambiguous endings",
  tragic: "doesn't mind tragic endings",
  any: "any ending is fine",
};

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** A bullet list for the model. */
export function describeAnswers(a: TasteAnswers): string {
  const chips = knownChips(a.genres);
  const lines = [
    a.formats.length ? `Watches: ${list(a.formats.map((f) => CATEGORY_LABEL[f]))}` : null,
    chips.some((c) => c.kind === "genre") ? `Picked genres: ${list(chips.filter((c) => c.kind === "genre").map((c) => c.label))}` : null,
    chips.some((c) => c.kind === "mood") ? `Picked moods: ${list(chips.filter((c) => c.kind === "mood").map((c) => c.label))}` : null,
    a.pace != null ? `Pace: ${leaning(a.pace, SCALES.pace)}` : null,
    a.tone != null ? `Tone: ${leaning(a.tone, SCALES.tone)}` : null,
    a.complexity != null ? `Complexity: ${leaning(a.complexity, SCALES.complexity)}` : null,
    a.era != null ? `Era: ${leaning(a.era, SCALES.era)}` : null,
    a.endings ? `Endings: ${ENDING[a.endings]}` : null,
    a.subtitles != null ? `Subtitles: ${a.subtitles ? "happy to read them" : "would rather not"}` : null,
    a.languages.length ? `Languages: ${list(a.languages.map(languageLabel))}` : null,
  ];
  return lines.filter(Boolean).map((l) => `- ${l}`).join("\n");
}

/**
 * The answers as one search-style query ("Dark, slow-burn sci-fi and thriller
 * films and series…"), embedded as the answer vector.
 */
export function answerStatement(a: TasteAnswers): string {
  const chips = knownChips(a.genres);
  const moods = chips.filter((c) => c.kind === "mood").map((c) => c.label.toLowerCase());
  const genres = chips.filter((c) => c.kind === "genre").map((c) => c.label);
  const formats = a.formats.length ? a.formats.map((f) => CATEGORY_LABEL[f].toLowerCase()) : ["films", "series"];
  const feel = [
    a.pace != null && a.pace <= 0.4 ? "slow-burn" : a.pace != null && a.pace >= 0.6 ? "fast-paced" : null,
    a.tone != null && a.tone <= 0.4 ? "light-hearted" : a.tone != null && a.tone >= 0.6 ? "dark" : null,
    a.complexity != null && a.complexity >= 0.6 ? "thought-provoking" : a.complexity != null && a.complexity <= 0.4 ? "easy to watch" : null,
  ].filter((x): x is string => x != null);

  const head = [list([...new Set([...moods, ...feel])]), genres.length ? list(genres) : null, list(formats)].filter(Boolean).join(" ");
  const tail = [
    a.era != null && a.era >= 0.6 ? "Classics welcome." : a.era != null && a.era <= 0.4 ? "Mostly recent releases." : null,
    a.endings && a.endings !== "any" ? `${ENDING[a.endings][0]!.toUpperCase()}${ENDING[a.endings].slice(1)}.` : null,
    a.languages.length ? `In ${list(a.languages.map(languageLabel))}.` : null,
  ].filter(Boolean);
  const sentence = head ? `${head[0]!.toUpperCase()}${head.slice(1)}.` : "";
  return [sentence, ...tail].join(" ").trim();
}
