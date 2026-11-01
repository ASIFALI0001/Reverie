"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { authSdk } from "@/lib/auth/firebase-client";

/**
 * Confirm it's really the admin, right now (sensitive actions need a sign-in within 30 minutes):
 * the password again, or Google's popup. Returns a fresh ID token for the retried request.
 */
export function useReauth() {
  const { user, ensureAuth } = useAuth();
  const usesPassword = user?.providerData.some((p) => p.providerId === "password") ?? false;

  async function reauth(password?: string): Promise<string> {
    const [auth, sdk] = await Promise.all([ensureAuth(), authSdk()]);
    const current = auth.currentUser ?? user;
    if (!current) throw new Error("Sign in again to continue.");
    if (usesPassword) await sdk.reauthenticateWithCredential(current, sdk.EmailAuthProvider.credential(current.email ?? "", password ?? ""));
    else await sdk.reauthenticateWithPopup(current, new sdk.GoogleAuthProvider());
    return current.getIdToken(true);
  }

  return { usesPassword, reauth };
}
