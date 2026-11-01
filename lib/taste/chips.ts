import type { Vibe } from "@/lib/catalog/types";

type Scale = "pace" | "tone" | "complexity";

export type ChipDef = {
  id: string;
  label: string;
  kind: "genre" | "mood";
  /** TMDB genre names (movie and TV spellings) this chip stands for. */
  genres?: string[];
  /** Vibe mood/theme tags that signal this mood. */
  moods?: string[];
  /** A vibe-scale condition that also counts as a match, e.g. slow-burn = pace ≤ 0.35. */
  scale?: { key: Scale; op: "lte" | "gte"; value: number };
  /** Where an untouched slider should lean when this mood is picked. */
  lean?: Partial<Record<Scale, number>>;
};

export const GENRE_CHIPS: ChipDef[] = [
  { id: "sci-fi", label: "Sci-Fi", kind: "genre", genres: ["Science Fiction", "Sci-Fi & Fantasy"] },
  { id: "thriller", label: "Thriller", kind: "genre", genres: ["Thriller"] },
  { id: "mystery", label: "Mystery", kind: "genre", genres: ["Mystery"] },
  { id: "horror", label: "Horror", kind: "genre", genres: ["Horror"] },
  { id: "action", label: "Action", kind: "genre", genres: ["Action", "Action & Adventure"] },
  { id: "adventure", label: "Adventure", kind: "genre", genres: ["Adventure", "Action & Adventure"] },
  { id: "comedy", label: "Comedy", kind: "genre", genres: ["Comedy"] },
  { id: "romance", label: "Romance", kind: "genre", genres: ["Romance"] },
  { id: "drama", label: "Drama", kind: "genre", genres: ["Drama"] },
  { id: "fantasy", label: "Fantasy", kind: "genre", genres: ["Fantasy", "Sci-Fi & Fantasy"] },
  { id: "crime", label: "Crime", kind: "genre", genres: ["Crime"] },
  { id: "documentary", label: "Documentary", kind: "genre", genres: ["Documentary"] },
  { id: "family", label: "Family", kind: "genre", genres: ["Family", "Kids"] },
  { id: "history", label: "History & war", kind: "genre", genres: ["History", "War", "War & Politics"] },
];

export const MOOD_CHIPS: ChipDef[] = [
  {
    id: "slow-burn",
    label: "Slow-burn",
    kind: "mood",
    moods: ["slow-burn", "atmospheric", "contemplative", "meditative", "somber", "brooding"],
    scale: { key: "pace", op: "lte", value: 0.35 },
    lean: { pace: 0.25 },
  },
  {
    id: "mind-bending",
    label: "Mind-bending",
    kind: "mood",
    moods: ["mind-bending", "surreal", "cerebral", "enigmatic", "thought-provoking", "puzzling"],
    scale: { key: "complexity", op: "gte", value: 0.72 },
    lean: { complexity: 0.8 },
  },
  {
    id: "feel-good",
    label: "Feel-good",
    kind: "mood",
    moods: ["feel-good", "heartwarming", "uplifting", "cheerful", "lighthearted", "inspiring", "fun"],
    scale: { key: "tone", op: "lte", value: 0.28 },
    lean: { tone: 0.2 },
  },
  {
    id: "dark",
    label: "Dark",
    kind: "mood",
    moods: ["dark", "bleak", "grim", "gritty", "sinister", "cynical"],
    scale: { key: "tone", op: "gte", value: 0.75 },
    lean: { tone: 0.8 },
  },
  { id: "epic", label: "Epic", kind: "mood", moods: ["epic", "grand", "sweeping", "adventurous"] },
  { id: "edge-of-seat", label: "Edge-of-seat", kind: "mood", moods: ["tense", "suspenseful", "thrilling", "intense", "claustrophobic", "visceral"] },
  { id: "quirky", label: "Quirky", kind: "mood", moods: ["quirky", "whimsical", "witty", "playful", "offbeat", "absurd"] },
  { id: "bittersweet", label: "Bittersweet", kind: "mood", moods: ["bittersweet", "melancholic", "tender", "poignant", "nostalgic", "emotional"] },
  { id: "cozy", label: "Cozy", kind: "mood", moods: ["cozy", "comforting", "charming", "gentle", "warm"] },
];

export const ALL_CHIPS = [...GENRE_CHIPS, ...MOOD_CHIPS];
const BY_ID = new Map(ALL_CHIPS.map((c) => [c.id, c]));

export function chipById(id: string): ChipDef | undefined {
  return BY_ID.get(id);
}

/** Keep only chip ids we know (client input is untrusted). */
export function knownChips(ids: string[]): ChipDef[] {
  return [...new Set(ids)].map((id) => BY_ID.get(id)).filter((c): c is ChipDef => c != null);
}

type ChipTarget = { genres: string[]; vibe: Pick<Vibe, "pace" | "tone" | "complexity" | "mood" | "themes"> | null };

export function chipMatches(chip: ChipDef, t: ChipTarget): boolean {
  if (chip.genres?.some((g) => t.genres.includes(g))) return true;
  if (!t.vibe) return false;
  if (chip.moods?.some((m) => t.vibe!.mood.includes(m) || t.vibe!.themes.includes(m))) return true;
  if (chip.scale) {
    const v = t.vibe[chip.scale.key];
    return chip.scale.op === "lte" ? v <= chip.scale.value : v >= chip.scale.value;
  }
  return false;
}
