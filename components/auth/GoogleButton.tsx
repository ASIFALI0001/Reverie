"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { authSdk } from "@/lib/auth/firebase-client";
import { safeNext } from "@/lib/auth/constants";
import { readQueryParam } from "@/lib/hooks/use-query-param";

export const REDIRECT_NEXT_KEY = "rv:auth-next";

/** Google's four-colour "G" — the recognised affordance for this sign-in method. */
function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * Popup first; falls back to a full-page redirect when the popup is blocked (common in in-app browsers).
 * `onSignedIn` replaces the usual session + navigation step (the admin sign-in checks the role first);
 * that flow has no redirect fallback.
 */
export function GoogleButton({
  onError,
  label = "Continue with Google",
  onSignedIn,
}: {
  onError: (msg: string) => void;
  label?: string;
  onSignedIn?: (user: User) => Promise<void>;
}) {
  const router = useRouter();
  const { ensureAuth, completeSignIn } = useAuth();
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const next = safeNext(readQueryParam("next"));
    try {
      const [auth, { GoogleAuthProvider, signInWithPopup, signInWithRedirect }] = await Promise.all([ensureAuth(), authSdk()]);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        const { user } = await signInWithPopup(auth, provider);
        if (onSignedIn) {
          await onSignedIn(user);
          setPending(false);
          return;
        }
        router.replace(await completeSignIn(user, next));
        router.refresh();
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (onSignedIn && code === "auth/popup-blocked") throw new Error("Allow pop-ups for this site to sign in with Google.");
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-environment") {
          sessionStorage.setItem(REDIRECT_NEXT_KEY, next ?? "");
          await signInWithRedirect(auth, provider);
          return;
        }
        throw err;
      }
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) onError(message);
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" size="lg" className="w-full" onClick={signIn} pending={pending}>
      <GoogleG /> {label}
    </Button>
  );
}
