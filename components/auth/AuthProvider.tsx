"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Auth, User } from "firebase/auth";
import { authSdk, loadAuth, readHint } from "@/lib/auth/firebase-client";
import { safeNext } from "@/lib/auth/constants";
import { api, ApiClientError } from "@/lib/api/client";
import type { PublicUser } from "@/lib/db/models/User";

export type AuthStatus = "loading" | "signed-in" | "signed-out";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Load Firebase and start listening (idempotent). */
  ensureAuth: () => Promise<Auth>;
  /** After any successful Firebase sign-in: mint the session, bootstrap the profile, return where to go. */
  completeSignIn: (user: User, next?: string | null) => Promise<string>;
  /** Sign out and go to the landing page, or to `redirectTo` (null stays on the current page). */
  signOut: (opts?: { redirectTo?: string | null }) => Promise<void>;
  /** True while an intentional sign-out is navigating away — guards must not bounce to /signin. */
  isSigningOut: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DAY_S = 24 * 60 * 60;
export const ME_QUERY_KEY = ["me"] as const;

async function postSession(user: User, forceRefresh: boolean) {
  const idToken = await user.getIdToken(forceRefresh);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiClientError(res.status, json?.error?.code ?? "session_failed", json?.error?.message ?? "Couldn’t start your session.");
  }
}

const noopSubscribe = () => () => {};
const hintSnapshot = () => (readHint() !== null ? "present" : "absent");
// The server can't see cookies, so hydration starts "unknown" and settles on the client.
const hintServerSnapshot = () => "unknown" as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [firebase, setFirebase] = useState<{ status: AuthStatus; user: User | null }>({ status: "loading", user: null });
  const hint = useSyncExternalStore(noopSubscribe, hintSnapshot, hintServerSnapshot);
  const listening = useRef(false);
  const leaving = useRef(false);

  // Without a session hint we know the visitor is signed out without downloading Firebase.
  // If an auth page loads Firebase and finds a remembered user, its status takes over.
  const knownSignedOut = firebase.status === "loading" && hint === "absent";
  const status: AuthStatus = knownSignedOut ? "signed-out" : firebase.status;
  const user = knownSignedOut ? null : firebase.user;

  const ensureAuth = useCallback(async () => {
    const auth = await loadAuth();
    if (!listening.current) {
      listening.current = true;
      const { onIdTokenChanged } = await authSdk();
      onIdTokenChanged(auth, (user) => {
        setFirebase({ status: user ? "signed-in" : "signed-out", user });
        const hint = readHint();
        if (user && hint !== null && Date.now() / 1000 - hint > DAY_S) {
          // Sliding session: quietly extend a still-valid cookie for active users.
          postSession(user, false).catch(() => {});
        } else if (!user && hint !== null) {
          // Browser lost its Firebase state (storage cleared); drop the stale cookie too.
          fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
        }
      });
    }
    return auth;
  }, []);

  useEffect(() => {
    if (hint === "present") {
      ensureAuth().catch(() => setFirebase({ status: "signed-out", user: null }));
    }
  }, [ensureAuth, hint]);

  const completeSignIn = useCallback(
    async (user: User, next?: string | null) => {
      leaving.current = false;
      await postSession(user, true);
      let profile: PublicUser;
      try {
        ({ user: profile } = await api<{ user: PublicUser; isNew: boolean }>("/api/users/bootstrap", {
          method: "POST",
          token: await user.getIdToken(),
        }));
      } catch (err) {
        // A blocked account signs in to read why, and goes nowhere else.
        if (err instanceof ApiClientError && err.code === "ACCOUNT_BLOCKED") return "/blocked";
        throw err;
      }
      queryClient.setQueryData(ME_QUERY_KEY, profile);
      return profile.onboardingDone ? (safeNext(next) ?? "/") : "/onboarding";
    },
    [queryClient],
  );

  const signOut = useCallback(
    async ({ redirectTo = "/" }: { redirectTo?: string | null } = {}) => {
      // Raised before Firebase reports "signed out", so page guards don't race us to /signin.
      leaving.current = true;
      const [auth, { signOut: fbSignOut }] = await Promise.all([loadAuth(), authSdk()]);
      await fbSignOut(auth);
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      queryClient.clear();
      if (redirectTo === null) {
        leaving.current = false;
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    },
    [queryClient, router],
  );

  const isSigningOut = useCallback(() => leaving.current, []);

  const value = useMemo(
    () => ({ status, user, ensureAuth, completeSignIn, signOut, isSigningOut }),
    [status, user, ensureAuth, completeSignIn, signOut, isSigningOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
