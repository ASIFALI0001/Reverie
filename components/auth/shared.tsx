"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { REDIRECT_NEXT_KEY } from "@/components/auth/GoogleButton";
import { authSdk } from "@/lib/auth/firebase-client";
import { z } from "zod";
import { safeNext } from "@/lib/auth/constants";
import { readQueryParam } from "@/lib/hooks/use-query-param";

export const isEmail = (s: string) => z.email().safeParse(s.trim()).success;

export function AuthHeading({ title, lede }: { title: ReactNode; lede: ReactNode }) {
  return (
    <header>
      <h1 className="text-h2">{title}</h1>
      <p className="mt-3 max-w-[34ch] text-muted">{lede}</p>
    </header>
  );
}

export function OrDivider({ children = "or with email" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-meta text-muted" role="separator">
      <span className="h-px flex-1 bg-hairline-strong" />
      {children}
      <span className="h-px flex-1 bg-hairline-strong" />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-meta text-danger">
      {message}
    </p>
  );
}

/** Finishes a Google sign-in that went through the redirect flow (popup was blocked). */
export function useGoogleRedirectResult(onError: (msg: string) => void) {
  const router = useRouter();
  const { ensureAuth, completeSignIn } = useAuth();

  // Auth pages always load Firebase: a returning user can continue without retyping anything.
  useEffect(() => {
    ensureAuth().catch(() => {});
  }, [ensureAuth]);

  useEffect(() => {
    const stored = sessionStorage.getItem(REDIRECT_NEXT_KEY);
    if (stored === null) return;
    sessionStorage.removeItem(REDIRECT_NEXT_KEY);
    (async () => {
      const [auth, { getRedirectResult }] = await Promise.all([ensureAuth(), authSdk()]);
      const result = await getRedirectResult(auth);
      if (result?.user) {
        router.replace(await completeSignIn(result.user, safeNext(stored) ?? safeNext(readQueryParam("next"))));
        router.refresh();
      }
    })().catch((err: unknown) => {
      const message = authErrorMessage(err);
      if (message) onError(message);
    });
    // Runs once on arrival back from Google.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
