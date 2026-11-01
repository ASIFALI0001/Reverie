import type { Category, TitleKey } from "@/lib/catalog/types";

export type Ending = "happy" | "ambiguous" | "tragic" | "any";
export type SwipeVerdict = "loved" | "disliked" | "unseen";

/** Onboarding answers (brief §5.2 `answers`). Sliders are 0–1, or null when left untouched. */
export type TasteAnswers = {
  formats: Category[];
  /** Genre and mood chip ids (see lib/taste/chips.ts). */
  genres: string[];
  /** 0 = slow-burn … 1 = fast and loud */
  pace: number | null;
  /** 0 = light … 1 = dark */
  tone: number | null;
  /** 0 = easy watch … 1 = make me think */
  complexity: number | null;
  /** 0 = new releases … 1 = classics */
  era: number | null;
  endings: Ending | null;
  subtitles: boolean | null;
  languages: string[];
};

export type RadarPoint = {
  axis: string;
  /** 0–1, where 0.5 is neutral. */
  value: number;
  /** How many of the viewer's titles back this axis. */
  evidence: number;
};

/** What the UI gets about a taste profile. */
export type TasteView = {
  status: "none" | "ready";
  version: number;
  dna: string[];
  summary: string | null;
  radar: RadarPoint[];
  vibe: { pace: number; tone: number; complexity: number } | null;
  signalCount: number;
  topGenres: { genre: string; affinity: number }[];
  updatedAt: string | null;
};

/** A few well-known poster paths per format, for the onboarding tiles. */
export type FormatPosters = Record<Category, string[]>;

/** A card in the onboarding swipe deck. */
export type DeckCard = {
  key: TitleKey;
  title: string;
  year: number | null;
  category: Category;
  posterPath: string;
  posterBlur: string | null;
  color: string | null;
  genres: string[];
};
