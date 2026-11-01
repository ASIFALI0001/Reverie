/** httpOnly Firebase session cookie (verified server-side). */
export const SESSION_COOKIE = "rv_session";
/** Readable companion cookie: its value is the session's issued-at (epoch seconds). Never trusted for auth. */
export const HINT_COOKIE = "rv_hint";
/** Firebase caps session cookies at 14 days. */
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 14;
/** A session may be minted only this soon after an actual sign-in (stolen-token defence). */
export const FRESH_SIGN_IN_S = 5 * 60;

export const PROTECTED_PREFIXES = ["/home", "/library", "/watchlist", "/onboarding", "/settings", "/friends", "/u", "/lists", "/mood", "/taste"];

/** Only same-site relative paths are allowed as post-sign-in destinations (no open redirects). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
