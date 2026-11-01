/**
 * An invite opened while signed out has to survive sign-up and onboarding: the code waits in
 * this browser until onboarding ends, then the invite page takes over. Storage can be off
 * (private windows), so every access is guarded; worst case the invite just isn't resumed.
 */

const KEY = "rv:pending-invite";
const MAX_AGE_MS = 7 * 86_400_000;

export function rememberInvite(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {}
}

export function pendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof code !== "string" || typeof at !== "number" || Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Where to go when onboarding ends: back to the invite that brought them, or home. */
export function afterOnboarding(): string {
  const code = pendingInvite();
  return code ? `/invite/${code}?joined=1` : "/";
}
