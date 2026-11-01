import type { TitleKey } from "@/lib/catalog/types";
import type { SwipeVerdict } from "@/lib/taste/types";

/** Taste signal weights (brief §5.2), pure and unit-tested. */

export type SignalType = "loved" | "liked" | "disliked" | "watched" | "dropped" | "watchlisted";
export type SignalSource = "rating" | "favourite" | "swipe" | "library" | "watchlist" | "feedback";

export type Signal = {
  key: TitleKey;
  type: SignalType;
  source: SignalSource;
  rating: number | null;
  at: Date;
  /** Final weight, after time decay. Negative = the viewer didn't like it. */
  weight: number;
};

export const WEIGHTS = {
  favourite: 1.2,
  swipeLoved: 0.8,
  swipeDisliked: -0.7,
  dropped: -0.5,
  // The brief leaves these three unweighted; mild positives, since choosing to watch is itself a signal.
  watching: 0.4,
  watchedUnrated: 0.3,
  watchlisted: 0.25,
  // "Was this right?" on a why-not explanation: a whisper, never more than that.
  whyNotConfirmed: -0.2,
  whyNotRejected: 0.15,
} as const;

/** Ratings are 1–10 (half stars). 9–10 → +1.0, 7–8 → +0.6, 5–6 → +0.1, ≤4 → −0.7. */
export function ratingWeight(rating: number): number {
  if (rating >= 9) return 1;
  if (rating >= 7) return 0.6;
  if (rating >= 5) return 0.1;
  return -0.7;
}

function ratingType(rating: number): SignalType {
  if (rating >= 9) return "loved";
  if (rating >= 7) return "liked";
  if (rating >= 5) return "watched";
  return "disliked";
}

/** Gentle time decay: a year-old signal keeps ~75% of its weight, nothing drops below 60%. */
export function decay(ageDays: number): number {
  return 0.6 + 0.4 * Math.exp(-Math.max(0, ageDays) / 365);
}

export type SignalInputs = {
  library: { key: TitleKey; status: "watched" | "watching" | "dropped"; rating: number | null; at: Date }[];
  watchlist: { key: TitleKey; at: Date }[];
  swipes: { key: TitleKey; verdict: SwipeVerdict; at: Date }[];
  favourites: { key: TitleKey; at: Date }[];
  /** Answers to "Was this right?" under a low match: yes (it isn't for them) or no (they might like it). */
  whyNot?: { key: TitleKey; helpful: boolean; at: Date }[];
};

const DAY_MS = 86_400_000;

/**
 * One signal per title, taken from its most deliberate source:
 * rating › favourite › dropped › swipe › watching/watched › watchlisted › why-not feedback.
 * A favourite lifts a positive rating to the favourite weight; a low rating overrides it.
 * Favourites don't decay — "all-time" means all-time.
 */
export function mergeSignals(inputs: SignalInputs, now = new Date()): Signal[] {
  const lib = new Map(inputs.library.map((x) => [x.key, x]));
  const fav = new Map(inputs.favourites.map((x) => [x.key, x]));
  const swipe = new Map(inputs.swipes.map((x) => [x.key, x]));
  const wl = new Map(inputs.watchlist.map((x) => [x.key, x]));
  const fb = new Map((inputs.whyNot ?? []).map((x) => [x.key, x]));
  const keys = new Set<TitleKey>([...lib.keys(), ...fav.keys(), ...swipe.keys(), ...wl.keys(), ...fb.keys()]);

  const out: Signal[] = [];
  for (const key of keys) {
    const l = lib.get(key);
    const f = fav.get(key);
    const s = swipe.get(key);
    const w = wl.get(key);
    const n = fb.get(key);

    let base: Omit<Signal, "weight"> & { raw: number; decays: boolean };
    if (l && l.rating != null) {
      const raw = ratingWeight(l.rating);
      base = f && raw > 0
        ? { key, type: "loved", source: "favourite", rating: l.rating, at: f.at, raw: WEIGHTS.favourite, decays: false }
        : { key, type: ratingType(l.rating), source: "rating", rating: l.rating, at: l.at, raw, decays: true };
    } else if (f) {
      base = { key, type: "loved", source: "favourite", rating: null, at: f.at, raw: WEIGHTS.favourite, decays: false };
    } else if (l?.status === "dropped") {
      base = { key, type: "dropped", source: "library", rating: null, at: l.at, raw: WEIGHTS.dropped, decays: true };
    } else if (s && s.verdict !== "unseen") {
      const loved = s.verdict === "loved";
      base = { key, type: loved ? "loved" : "disliked", source: "swipe", rating: null, at: s.at, raw: loved ? WEIGHTS.swipeLoved : WEIGHTS.swipeDisliked, decays: true };
    } else if (l) {
      const raw = l.status === "watching" ? WEIGHTS.watching : WEIGHTS.watchedUnrated;
      base = { key, type: "watched", source: "library", rating: null, at: l.at, raw, decays: true };
    } else if (w) {
      base = { key, type: "watchlisted", source: "watchlist", rating: null, at: w.at, raw: WEIGHTS.watchlisted, decays: true };
    } else if (n) {
      base = n.helpful
        ? { key, type: "disliked", source: "feedback", rating: null, at: n.at, raw: WEIGHTS.whyNotConfirmed, decays: true }
        : { key, type: "liked", source: "feedback", rating: null, at: n.at, raw: WEIGHTS.whyNotRejected, decays: true };
    } else {
      continue; // "haven't seen" swipes carry no taste information
    }

    const { raw, decays, ...signal } = base;
    const ageDays = (now.getTime() - signal.at.getTime()) / DAY_MS;
    out.push({ ...signal, weight: decays ? raw * decay(ageDays) : raw });
  }
  return out;
}
