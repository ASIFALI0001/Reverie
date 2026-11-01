/**
 * Friend-boosted match (pure, unit-tested). Friends who rated a title nudge your match toward
 * their verdict, weighted by how close their taste is to yours:
 *
 *   s_i   = max(0, (tasteMatch_i − 40) / 60)    40% is "no relation" on the taste-match curve
 *   f     = Σ(s_i · r_i / 10) / Σ s_i           their ratings (1–10), weighted by similarity
 *   w     = 0.1 · min(1, Σ s_i / 1.5)           at most 10%, reached with about two close friends
 *   final = (1 − w) · match + w · 100 · f
 *
 * Only friends whose ratings you're allowed to see count, and never a title they hid. Taste
 * Twins add a second nudge of the same kind later; the two together stay within 20% of the score.
 */

export const FRIEND_MAX_WEIGHT = 0.1;
/** Σ similarity at which the friend nudge reaches its full weight. */
export const FRIEND_FULL_SIMILARITY = 1.5;
/** All outside nudges (friends + Taste Twins) together never weigh more than this. */
export const EXTERNAL_MAX_WEIGHT = 0.2;
/** A taste match at or below this is "no relation": that friend's rating doesn't move yours. */
export const NEUTRAL_TASTE_MATCH = 40;

export type FriendRating = { tasteMatch: number; rating: number };

/** Taste match (0–100) → similarity weight (0–1). */
export function similarityWeight(tasteMatch: number): number {
  return Math.max(0, Math.min(1, (tasteMatch - NEUTRAL_TASTE_MATCH) / (100 - NEUTRAL_TASTE_MATCH)));
}

export function friendComponent(friends: FriendRating[]): { f: number; w: number } | null {
  const usable = friends
    .filter((x) => Number.isFinite(x.rating) && x.rating >= 1 && x.rating <= 10)
    .map((x) => ({ s: similarityWeight(x.tasteMatch), r: x.rating }))
    .filter((x) => x.s > 0);
  const total = usable.reduce((sum, x) => sum + x.s, 0);
  if (!total) return null;
  const f = usable.reduce((sum, x) => sum + x.s * (x.r / 10), 0) / total;
  const w = FRIEND_MAX_WEIGHT * Math.min(1, total / FRIEND_FULL_SIMILARITY);
  return { f, w };
}

/** The match with the friend nudge applied (1–99, like every match), and how much it weighed. */
export function applyFriendBoost(match: number, friends: FriendRating[], maxWeight = FRIEND_MAX_WEIGHT): { score: number; weight: number } {
  const c = friendComponent(friends);
  if (!c) return { score: match, weight: 0 };
  const w = Math.min(c.w, maxWeight);
  const score = Math.round(Math.min(99, Math.max(1, (1 - w) * match + w * 100 * c.f)));
  return { score, weight: Math.round(w * 1000) / 1000 };
}
