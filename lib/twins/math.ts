import { EXTERNAL_MAX_WEIGHT, friendComponent, similarityWeight, type FriendRating } from "@/lib/social/friend-boost";

/**
 * Taste Twins, the pure part (unit-tested). Twins are the people whose taste is closest to yours
 * (the same 0–100 taste match friends see), among everyone who takes part. They stay anonymous,
 * a codename and a gradient, until both sides tap Connect.
 *
 * Twin nudge: when at least two of your twins rated a title, your match moves toward their
 * verdict, weighted by how close each twin is:
 *   t     = Σ(s_i · r_i/10) / Σ s_i         s_i = similarity weight of twin i (as for friends)
 *   final = (1 − w) · match + w · 100t      w = 0.15
 * With friends too, every outside nudge together stays within EXTERNAL_MAX_WEIGHT (20%): the
 * friends' share comes first (they're people you know), the twins' share takes what's left.
 */

export const TWIN_RULES = {
  /** A taste match below this isn't a twin. */
  minScore: 65,
  /** Twins kept (and shown) per person. */
  max: 10,
  /** Rated, swiped or saved titles before you're in the pool (less isn't a taste yet). */
  minSignals: 10,
  /** Twins who must have rated a title before it moves your match. */
  minRaters: 2,
  weight: 0.15,
  /** "Titles you both loved": both rated it this or higher. */
  loved: 8,
};

export type TwinRating = { score: number; rating: number };

export function twinComponent(twins: TwinRating[]): { t: number; raters: number } | null {
  const usable = twins
    .filter((x) => Number.isFinite(x.rating) && x.rating >= 1 && x.rating <= 10)
    .map((x) => ({ s: similarityWeight(x.score), r: x.rating }))
    .filter((x) => x.s > 0);
  if (usable.length < TWIN_RULES.minRaters) return null;
  const total = usable.reduce((a, x) => a + x.s, 0);
  return { t: usable.reduce((a, x) => a + x.s * (x.r / 10), 0) / total, raters: usable.length };
}

/**
 * Genres you both lean toward (from the tastes friends may see), strongest shared first: each
 * counts as much as the one of you who likes it less, so a genre only one of you loves doesn't.
 */
export function sharedGenres(a: { term: string; value: number }[], b: { term: string; value: number }[], n = 3, floor = 0.15): string[] {
  const theirs = new Map(b.map((x) => [x.term, x.value]));
  return a
    .filter((x) => x.value >= floor && (theirs.get(x.term) ?? 0) >= floor)
    .map((x) => ({ term: x.term, v: Math.min(x.value, theirs.get(x.term)!) }))
    .sort((p, q) => q.v - p.v || p.term.localeCompare(q.term))
    .slice(0, n)
    .map((x) => x.term);
}

export type Nudged = { score: number; friendWeight: number; twinWeight: number };

/** The match with friends' and twins' nudges applied (1–99), and how much each weighed. */
export function applyOutsideNudges(match: number, friends: FriendRating[], twins: TwinRating[]): Nudged {
  const f = friendComponent(friends);
  const t = twinComponent(twins);
  const wf = f ? Math.min(f.w, EXTERNAL_MAX_WEIGHT) : 0;
  const wt = t ? Math.max(0, Math.min(TWIN_RULES.weight, EXTERNAL_MAX_WEIGHT - wf)) : 0;
  if (!wf && !wt) return { score: match, friendWeight: 0, twinWeight: 0 };
  const raw = (1 - wf - wt) * match + (f ? wf * 100 * f.f : 0) + (t ? wt * 100 * t.t : 0);
  const round3 = (x: number) => Math.round(x * 1000) / 1000;
  return { score: Math.round(Math.min(99, Math.max(1, raw))), friendWeight: round3(wf), twinWeight: round3(wt) };
}

/** FNV-1a, 32-bit. */
function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, which read as 1 and 0

/**
 * "A7"-style codenames, stable for this viewer and twin, different from what anyone else sees
 * for the same twin (so codenames can't be compared to work out who someone is), and never
 * repeated within one list.
 */
export function codenames(viewer: string, twins: string[]): string[] {
  const used = new Set<string>();
  return twins.map((twin) => {
    for (let k = 0; ; k++) {
      const h = fnv(`${viewer}:${twin}:${k}`);
      const name = `${LETTERS[h % LETTERS.length]}${(h >>> 8) % 10}`;
      if (!used.has(name) || k > 50) {
        used.add(name);
        return name;
      }
    }
  });
}

/** Two hues for a twin's gradient avatar, from the same private pairing as the codename. */
export function twinHues(viewer: string, twin: string): [number, number] {
  const h = fnv(`hue:${viewer}:${twin}`);
  const a = h % 360;
  return [a, (a + 40 + ((h >>> 9) % 100)) % 360];
}
