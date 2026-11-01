"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { ShieldWarning } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { FormError, OrDivider, isEmail } from "@/components/auth/shared";
import { signInWithEmail } from "@/lib/auth/firebase-client";
import { useQueryParam } from "@/lib/hooks/use-query-param";

/**
 * The admin area's own sign-in: the same Firebase accounts as the app, but the role is
 * checked before any session is minted. Accounts without the admin claim are told so and
 * signed out again.
 */
export function AdminLogin() {
  const router = useRouter();
  const { ensureAuth, completeSignIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(useQueryParam("denied") === "1");
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function finish(user: User) {
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      await signOut({ redirectTo: null });
      setDenied(true);
      setPending(false);
      return;
    }
    await completeSignIn(user, "/admin");
    router.replace("/admin");
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEmail(email) || !password) {
      setError("Enter your email and password.");
      emailRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      const cred = await signInWithEmail(await ensureAuth(), email.trim(), password);
      await finish(cred.user);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center px-[var(--page-x)] py-16">
      <div className="w-full max-w-[24rem]">
        <div className="flex items-center justify-between">
          <Logo size={24} />
          <span className="caption text-muted">Admin</span>
        </div>
        <h1 className="mt-14 text-h3">Sign in to the control room</h1>
        <p className="mt-3 text-muted">For Reverie administrators. Everything you open here is logged.</p>

        {denied ? (
          <div role="alert" className="mt-8 flex gap-3 border-l-2 border-danger py-1 pl-4">
            <ShieldWarning size={20} weight="light" className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="text-text">This account isn’t an administrator.</p>
              <p className="mt-1 text-meta text-muted">
                You’ve been signed out of the admin area.{" "}
                <Link href="/" className="link-draw text-text">
                  Back to Reverie
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="mt-10 space-y-6">
          <Field ref={emailRef} label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" pending={pending}>
            Sign in
          </Button>
        </form>
        <div className="mt-6 space-y-6">
          <OrDivider>or</OrDivider>
          <GoogleButton onError={setError} onSignedIn={finish} />
        </div>
      </div>
    </main>
  );
}
