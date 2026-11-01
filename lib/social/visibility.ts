import type { FriendsSee } from "@/lib/db/models/User";

/**
 * The privacy rules for one person looking at another (pure, unit-tested; the server applies
 * them in lib/social/profile.ts and everywhere else friends' data is read).
 *
 * - Blocks come first: if either has blocked the other, the other simply doesn't exist for them
 *   (no profile, no search result, no requests). Callers check that before anything here.
 * - Anyone signed in can see a person's public card: name, handle, avatar, Taste DNA phrases and
 *   the taste match. Nothing else unless they're friends.
 * - Friends see what the owner allows: everything (library, ratings, watchlist, activity), ratings
 *   only, or nothing.
 * - Items marked "hide from friends" are never shown to anyone but the owner, whatever the setting.
 */

export type Relation = "self" | "friends" | "request-sent" | "request-received" | "none";
export type Scope = "ratings" | "library" | "watchlist" | "activity";

export const FRIENDS_SEE_SCOPES: Record<FriendsSee, readonly Scope[]> = {
  everything: ["ratings", "library", "watchlist", "activity"],
  ratings: ["ratings"],
  nothing: [],
};

export function canSee(relation: Relation, friendsSee: FriendsSee, scope: Scope): boolean {
  if (relation === "self") return true;
  if (relation !== "friends") return false;
  return FRIENDS_SEE_SCOPES[friendsSee].includes(scope);
}

export function visibleScopes(relation: Relation, friendsSee: FriendsSee): Scope[] {
  return (["ratings", "library", "watchlist", "activity"] as const).filter((s) => canSee(relation, friendsSee, s));
}

/** The Mongo filter every friend-facing library or watchlist read adds: hidden items never leave. */
export const SHOWN_TO_FRIENDS = { hiddenFromFriends: { $ne: true } } as const;

/**
 * Taste DNA phrases are written by a model from the whole library, so one could name a title
 * the person hid. Phrases that mention a hidden title's name (4+ characters) are dropped from
 * what others see.
 */
export function dnaForOthers(dna: string[], hiddenTitles: string[]): string[] {
  const names = hiddenTitles.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 4);
  if (!names.length) return dna;
  return dna.filter((phrase) => {
    const p = phrase.toLowerCase();
    return !names.some((n) => p.includes(n));
  });
}
