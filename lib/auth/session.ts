import "server-only";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { FRESH_SIGN_IN_S, SESSION_MAX_AGE_S } from "@/lib/auth/constants";
import { unauthorized } from "@/lib/http/errors";

/**
 * Exchange a Firebase ID token for a 14-day session cookie.
 * Allowed right after a real sign-in, or to extend a still-valid session for the
 * same user (a sliding session) — never from an old token alone.
 */
export async function mintSessionCookie(idToken: string, existingCookie?: string) {
  const auth = adminAuth();
  const decoded = await auth.verifyIdToken(idToken, true).catch(() => {
    throw unauthorized("Your sign-in expired. Try again.", "invalid_token");
  });

  const fresh = Date.now() / 1000 - decoded.auth_time < FRESH_SIGN_IN_S;
  let continuing = false;
  if (!fresh && existingCookie) {
    try {
      continuing = (await auth.verifySessionCookie(existingCookie, true)).uid === decoded.uid;
    } catch {
      continuing = false;
    }
  }
  if (!fresh && !continuing) throw unauthorized("Please sign in again.", "reauth_required");

  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_S * 1000 });
  return { cookie, uid: decoded.uid };
}
