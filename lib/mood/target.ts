import type { Category } from "@/lib/catalog/types";

/**
 * Mood Search (pure, unit-tested): what a mood means as a target, how much time and company
 * change it, how well a title fits it, and how three picks stay varied.
 *
 * Scales match the title vibes: pace 0 slow-burn … 1 fast and loud; tone 0 light … 1 dark;
 * complexity 0 easy … 1 demanding.
 */

export type Vibe3 = { pace: number; tone: number; complexity: number };

export type MoodTarget = {
  targetVibe: Vibe3;
  moods: string[];
  themesWanted: string[];
  themesAvoid: string[];
  /** Formats to stay within (empty: any). */
  formats: Category[];
  /** Longest film, or episode, in minutes (null: no limit). */
  runtimeMax: number | null;
  /** Comfort rewatch: pick from what they've already loved. */
  allowRewatch: boolean;
  /** TMDB genre names to lean toward (a nudge, not a filter). */
  genres: string[];
  /** One sentence describing the ideal pick, for the embedding search. */
  query: string;
};

export type MoodTime = "short" | "film" | "long" | "binge";
export type Company = "alone" | "partner" | "friends" | "family";

export const TIME_OPTIONS: { id: MoodTime; label: string; hint: string }[] = [
  { id: "short", label: "Under 30 minutes", hint: "An episode" },
  { id: "film", label: "About 90 minutes", hint: "A film" },
  { id: "long", label: "Two hours or more", hint: "Settle in" },
  { id: "binge", label: "The whole night", hint: "A series binge" },
];

export const COMPANY_OPTIONS: { id: Company; label: string }[] = [
  { id: "alone", label: "Just me" },
  { id: "partner", label: "With my partner" },
  { id: "friends", label: "With friends" },
  { id: "family", label: "With family" },
];

type Preset = { id: string; label: string; line: string; target: Omit<MoodTarget, "formats" | "runtimeMax"> };

/** The ten mood tiles, hand-mapped: a preset never needs a model call. */
export const MOOD_PRESETS: Preset[] = [
  {
    id: "light-fun",
    label: "Light & fun",
    line: "Nothing heavy. Something to smile at.",
    target: {
      targetVibe: { pace: 0.62, tone: 0.15, complexity: 0.25 },
      moods: ["funny", "playful", "feel-good", "charming", "witty"],
      themesWanted: ["friendship", "adventure", "misadventure"],
      themesAvoid: ["grief", "war", "abuse", "trauma"],
      allowRewatch: false,
      genres: ["Comedy", "Family", "Animation"],
      query: "A light, funny, feel-good story to unwind with",
    },
  },
  {
    id: "cant-sleep",
    label: "Can’t sleep",
    line: "Something gentle to settle into.",
    target: {
      targetVibe: { pace: 0.28, tone: 0.3, complexity: 0.3 },
      moods: ["calm", "gentle", "cozy", "dreamy", "soothing"],
      themesWanted: ["nature", "small town", "everyday life"],
      themesAvoid: ["violence", "horror", "gore", "suspense"],
      allowRewatch: false,
      genres: ["Documentary", "Animation", "Drama"],
      query: "A calm, gentle, soothing watch for a sleepless night",
    },
  },
  {
    id: "good-cry",
    label: "Need a good cry",
    line: "Let it all out.",
    target: {
      targetVibe: { pace: 0.32, tone: 0.72, complexity: 0.5 },
      moods: ["moving", "bittersweet", "heartbreaking", "tender", "emotional"],
      themesWanted: ["grief", "loss", "love", "family", "sacrifice"],
      themesAvoid: ["gore"],
      allowRewatch: false,
      genres: ["Drama", "Romance"],
      query: "A deeply moving, heartbreaking story that earns its tears",
    },
  },
  {
    id: "edge-of-seat",
    label: "Edge of my seat",
    line: "Tension, all the way through.",
    target: {
      targetVibe: { pace: 0.85, tone: 0.62, complexity: 0.55 },
      moods: ["tense", "thrilling", "suspenseful", "gripping", "intense"],
      themesWanted: ["survival", "heist", "chase", "conspiracy", "escape"],
      themesAvoid: [],
      allowRewatch: false,
      genres: ["Thriller", "Action", "Crime"],
      query: "A gripping, tense thriller that never lets up",
    },
  },
  {
    id: "make-me-think",
    label: "Make me think",
    line: "Something to chew on afterwards.",
    target: {
      targetVibe: { pace: 0.4, tone: 0.58, complexity: 0.9 },
      moods: ["thought-provoking", "cerebral", "mysterious", "philosophical", "haunting"],
      themesWanted: ["identity", "time", "consciousness", "morality", "memory"],
      themesAvoid: [],
      allowRewatch: false,
      genres: ["Science Fiction", "Mystery", "Drama"],
      query: "A thought-provoking, cerebral story that stays with you",
    },
  },
  {
    id: "comfort-rewatch",
    label: "Comfort rewatch",
    line: "An old favourite, like a warm blanket.",
    target: {
      targetVibe: { pace: 0.5, tone: 0.3, complexity: 0.35 },
      moods: ["cozy", "warm", "nostalgic", "comforting"],
      themesWanted: [],
      themesAvoid: [],
      allowRewatch: true,
      genres: [],
      query: "A warm, comforting favourite to watch again",
    },
  },
  {
    id: "feel-inspired",
    label: "Feel inspired",
    line: "Leave a little braver than you came.",
    target: {
      targetVibe: { pace: 0.55, tone: 0.35, complexity: 0.5 },
      moods: ["uplifting", "inspiring", "hopeful", "triumphant"],
      themesWanted: ["perseverance", "underdog", "ambition", "courage", "dreams"],
      themesAvoid: ["nihilism"],
      allowRewatch: false,
      genres: ["Drama", "Documentary", "History"],
      query: "An uplifting, inspiring story about courage and perseverance",
    },
  },
  {
    id: "scare-me",
    label: "Scare me",
    line: "Lights off. Don’t look behind you.",
    target: {
      targetVibe: { pace: 0.62, tone: 0.92, complexity: 0.45 },
      moods: ["scary", "creepy", "eerie", "terrifying", "unsettling"],
      themesWanted: ["haunting", "supernatural", "possession", "survival"],
      themesAvoid: [],
      allowRewatch: false,
      genres: ["Horror", "Thriller"],
      query: "A genuinely scary, eerie horror film",
    },
  },
  {
    id: "romantic",
    label: "Romantic",
    line: "Something with a lot of heart.",
    target: {
      targetVibe: { pace: 0.4, tone: 0.35, complexity: 0.4 },
      moods: ["romantic", "tender", "charming", "warm", "swoony"],
      themesWanted: ["love", "relationships", "second chances"],
      themesAvoid: ["gore", "horror"],
      allowRewatch: false,
      genres: ["Romance", "Comedy", "Drama"],
      query: "A romantic, tender love story",
    },
  },
  {
    id: "background",
    label: "Background while eating",
    line: "Easy to follow with half an eye.",
    target: {
      targetVibe: { pace: 0.55, tone: 0.2, complexity: 0.12 },
      moods: ["easygoing", "funny", "light", "breezy"],
      themesWanted: ["friendship", "workplace", "family"],
      themesAvoid: ["mystery", "conspiracy"],
      allowRewatch: false,
      genres: ["Comedy", "Animation"],
      query: "An easygoing, funny episode that's easy to follow",
    },
  },
];

export function presetById(id: string | null | undefined): Preset | null {
  return MOOD_PRESETS.find((p) => p.id === id) ?? null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Time is a hard limit on what fits: format and length (minutes per film or episode). */
export function timeConstraints(time: MoodTime): { mediaType: "movie" | "tv"; runtimeMin: number | null; runtimeMax: number | null } {
  switch (time) {
    case "short":
      return { mediaType: "tv", runtimeMin: null, runtimeMax: 35 };
    case "film":
      return { mediaType: "movie", runtimeMin: 70, runtimeMax: 115 };
    case "long":
      return { mediaType: "movie", runtimeMin: 100, runtimeMax: null };
    case "binge":
      return { mediaType: "tv", runtimeMin: null, runtimeMax: null };
  }
}

/** Company nudges the target: family softens it, friends lift the pace a touch. */
export function withCompany(t: MoodTarget, company: Company | null): MoodTarget {
  if (company === "family") {
    return {
      ...t,
      targetVibe: { ...t.targetVibe, tone: Math.min(t.targetVibe.tone, 0.5) },
      themesAvoid: [...new Set([...t.themesAvoid, "violence", "gore", "sexuality", "drugs"])],
      genres: [...new Set([...t.genres, "Family", "Animation"])],
    };
  }
  if (company === "friends") return { ...t, targetVibe: { ...t.targetVibe, pace: clamp01(t.targetVibe.pace + 0.1) } };
  return t;
}

const norm = (s: string) => s.toLowerCase().trim();
/** "heartbreak" matches "heartbreaking"; "found family" matches "family". */
const softMatch = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x));
};

export type MoodCandidate = { vibe: Vibe3 | null; moods: string[]; themes: string[]; genres: string[] };

/**
 * How well a title fits the mood, 0–1:
 *   0.6 · (1 − vibe distance)  +  0.4 · share of the wanted moods and themes it carries
 *   + 0.1 if it's in a genre the mood leans to, − 0.25 if it carries something to avoid.
 * The vibe distance is the mean gap on the three scales; a title without a vibe sits at 0.5.
 */
export function moodFit(c: MoodCandidate, t: MoodTarget): number {
  const distance = c.vibe
    ? (Math.abs(c.vibe.pace - t.targetVibe.pace) + Math.abs(c.vibe.tone - t.targetVibe.tone) + Math.abs(c.vibe.complexity - t.targetVibe.complexity)) / 3
    : 0.5;
  const wanted = [...new Set([...t.moods, ...t.themesWanted])];
  const has = [...c.moods, ...c.themes];
  const matched = wanted.filter((w) => has.some((h) => softMatch(w, h))).length;
  const overlap = wanted.length ? Math.min(1, matched / Math.min(wanted.length, 4)) : 0.5;
  const lean = t.genres.length && c.genres.some((g) => t.genres.includes(g)) ? 0.1 : 0;
  const avoid = t.themesAvoid.some((a) => has.some((h) => softMatch(a, h))) ? 0.25 : 0;
  return clamp01(0.6 * (1 - distance) + 0.4 * overlap + lean - avoid);
}

/** Mood and taste count equally: 0.5 · mood fit (as %) + 0.5 · match %. */
export function moodScore(fit: number, match: number | null): number {
  return Math.round(0.5 * fit * 100 + 0.5 * (match ?? 50));
}

/** Three picks, never two from the same franchise or collection (no "three sequels"). */
export function pickVaried<T extends { franchise: string | null; collection: number | null }>(ranked: T[], n = 3, taken: T[] = []): T[] {
  const used = new Set(taken.flatMap((t) => [t.franchise ? `f:${t.franchise}` : null, t.collection != null ? `c:${t.collection}` : null].filter(Boolean) as string[]));
  const out: T[] = [];
  for (const r of ranked) {
    if (out.length >= n) break;
    const ids = [r.franchise ? `f:${r.franchise}` : null, r.collection != null ? `c:${r.collection}` : null].filter(Boolean) as string[];
    if (ids.some((id) => used.has(id))) continue;
    ids.forEach((id) => used.add(id));
    out.push(r);
  }
  return out;
}
