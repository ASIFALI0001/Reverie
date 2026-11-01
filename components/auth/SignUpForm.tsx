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
import { authSdk } from "@/lib/auth/firebase-client";
import { safeNext } from "@/lib/auth/constants";
import { readQueryParam, useQueryParam } from "@/lib/hooks/use-query-param";

export const MIN_PASSWORD = 8;

export function SignUpForm() {
  const router = useRouter();
  const next = safeNext(useQueryParam("next"));
  const { ensureAuth, completeSignIn } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useGoogleRedirectResult(setError);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Tell us what to call you.";
    if (!isEmail(email)) errs.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD) errs.password = `Use at least ${MIN_PASSWORD} characters.`;
    setFieldErrors(errs);
    setError(null);
    if (errs.name) return nameRef.current?.focus();
    if (errs.email) return emailRef.current?.focus();
    if (errs.password) return passwordRef.current?.focus();

    setPending(true);
    try {
      const [auth, { createUserWithEmailAndPassword, updateProfile }] = await Promise.all([ensureAuth(), authSdk()]);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      router.replace(await completeSignIn(cred.user, safeNext(readQueryParam("next"))));
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <div>
      <AuthHeading title="Create your account" lede="Two minutes of questions, then every title comes with a match score made for you." />
      <div className="mt-10 space-y-7">
        <GoogleButton onError={setError} label="Sign up with Google" />
        <OrDivider />
        <form noValidate onSubmit={onSubmit} className="space-y-6">
          <Field
            ref={nameRef}
            label="Name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
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
          <PasswordField
            ref={passwordRef}
            label="Password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={`At least ${MIN_PASSWORD} characters.`}
            error={fieldErrors.password}
          />
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" pending={pending}>
            {pending ? "Creating your account…" : "Create account"}
          </Button>
        </form>
        {/* New tab: reading the terms shouldn't cost a half-filled form. */}
        <p className="text-meta text-muted">
          By creating an account, you agree to Reverie’s{" "}
          <Link href="/terms" target="_blank" className="link-draw text-text">
            Terms of Service
          </Link>{" "}
          and confirm you’ve read the{" "}
          <Link href="/privacy" target="_blank" className="link-draw text-text">
            Privacy Policy
          </Link>
          .
        </p>
        <p className="text-meta text-muted">
          Already have an account?{" "}
          <Link href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-draw text-text">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
