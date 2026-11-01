"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { AuthHeading, FormError, OrDivider, isEmail, useGoogleRedirectResult } from "@/components/auth/shared";
import { readHint, signInWithEmail } from "@/lib/auth/firebase-client";
import { safeNext } from "@/lib/auth/constants";
import { readQueryParam, useQueryParam } from "@/lib/hooks/use-query-param";

export function SignInForm() {
  const router = useRouter();
  const next = safeNext(useQueryParam("next"));
  const justReset = useQueryParam("reset") === "1";
  const { status, user, ensureAuth, completeSignIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useGoogleRedirectResult(setError);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!isEmail(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Enter your password.";
    setFieldErrors(errs);
    setError(null);
    if (errs.email) return emailRef.current?.focus();
    if (errs.password) return passwordRef.current?.focus();

    setPending(true);
    try {
      const cred = await signInWithEmail(await ensureAuth(), email.trim(), password);
      router.replace(await completeSignIn(cred.user, safeNext(readQueryParam("next"))));
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  async function continueAsCurrent() {
    if (!user) return;
    if (readHint() !== null) {
      router.replace(next ?? "/");
      return;
    }
    setPending(true);
    try {
      router.replace(await completeSignIn(user, next));
      router.refresh();
    } catch {
      setError("For your security, sign in again to continue.");
      setEmail(user.email ?? "");
      setPending(false);
      passwordRef.current?.focus();
    }
  }

  return (
    <div>
      <AuthHeading
        title="Sign in"
        lede={justReset ? "Password updated. Sign in with your new one." : "Your matches, library and watchlist are waiting."}
      />

      {status === "signed-in" && user ? (
        <div className="mt-8 flex items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-hairline-strong p-4">
          <div className="min-w-0">
            <p className="truncate">{user.displayName ?? user.email}</p>
            <p className="text-meta text-muted">Already signed in on this browser</p>
          </div>
          <Button size="sm" onClick={continueAsCurrent} pending={pending}>
            Continue
          </Button>
        </div>
      ) : null}

      <div className="mt-10 space-y-7">
        <GoogleButton onError={setError} />
        <OrDivider />
        <form noValidate onSubmit={onSubmit} className="space-y-6">
          <Field
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <div>
            <PasswordField
              ref={passwordRef}
              label="Password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />
            <div className="mt-3 flex justify-end">
              <Link
                href={`/forgot-password${email && isEmail(email) ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
                className="link-draw text-meta text-muted hover:text-text"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" pending={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-meta text-muted">
          New to Reverie?{" "}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-draw text-text">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
