import { foldDiacritics } from "@/lib/format";

/**
 * @handles: lowercase, 3–20 characters of letters, numbers, underscores and dots.
 * No leading/trailing or doubled dots (they read badly in a URL), and reserved words are out.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

const RESERVED = new Set([
  "about", "admin", "administrator", "api", "app", "blocked", "blocks", "bootstrap", "friend", "friends", "help", "home", "invite",
  "library", "login", "logout", "me", "mod", "moderator", "mood", "null", "official", "onboarding", "person",
  "privacy", "reverie", "root", "search", "security", "settings", "share", "signin", "signout", "signup",
  "staff", "support", "system", "taste", "team", "terms", "title", "tmdb", "twins", "u", "undefined", "user",
  "users", "watchlist", "you",
]);

/** "@Asif.A " → "asif.a". */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Why a (normalized) handle can't be used, in words for the form, or null when it's fine. */
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN) return `At least ${HANDLE_MIN} characters.`;
  if (handle.length > HANDLE_MAX) return `At most ${HANDLE_MAX} characters.`;
  if (!/^[a-z0-9._]+$/.test(handle)) return "Letters, numbers, underscores and dots only.";
  if (handle.startsWith(".") || handle.endsWith(".")) return "It can’t start or end with a dot.";
  if (handle.includes("..")) return "No double dots.";
  if (RESERVED.has(handle)) return "That one’s reserved.";
  return null;
}

export const isValidHandle = (handle: string) => handleProblem(handle) === null;

/** A valid starting point from a display name or email: "Asif Ahmed" → "asifahmed". */
export function suggestHandleBase(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.split("@")[0] || "";
  let handle = foldDiacritics(source)
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, HANDLE_MAX - 4); // room for a numeric suffix
  handle = handle.replace(/\.+$/, "");
  if (handle.length < HANDLE_MIN) handle = `${handle || "viewer"}_rv`.replace(/^_+/, "").slice(0, HANDLE_MAX - 4);
  if (RESERVED.has(handle)) handle = `${handle}_rv`;
  return handle;
}

/** Candidates in order: the base, then the base with 2–3 digit suffixes (only valid ones). */
export function handleCandidates(base: string, count = 10, random: () => number = Math.random): string[] {
  const stem = base.slice(0, HANDLE_MAX - 3);
  const out = [base];
  for (let i = 0; i < count; i++) out.push(`${stem}${Math.floor(10 + random() * 990)}`);
  return [...new Set(out)].filter(isValidHandle);
}
