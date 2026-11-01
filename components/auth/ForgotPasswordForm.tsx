"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthHeading, FormError, isEmail } from "@/components/auth/shared";
import { authSdk } from "@/lib/auth/firebase-client";
import { duration, ease } from "@/lib/motion";
import { useQueryParam } from "@/lib/hooks/use-query-param";

export function ForgotPasswordForm() {
  const { ensureAuth } = useAuth();
  const prefill = useQueryParam("email");
  const [typed, setTyped] = useState<string | null>(null);
  const email = typed ?? prefill ?? "";
  const setEmail = setTyped;
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEmail(email)) {
      setFieldError("Enter a valid email address.");
      return emailRef.current?.focus();
    }
    setFieldError(null);
    setPending(true);
    const address = email.trim();
    try {
      const [auth, { sendPasswordResetEmail }] = await Promise.all([ensureAuth(), authSdk()]);
      await sendPasswordResetEmail(auth, address, { url: `${window.location.origin}/signin?reset=1` });
      setSentTo(address);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Only say something when the person can act on it; never hint whether the account exists.
      if (code === "auth/network-request-failed") setError("Can’t reach the sign-in service. Check your connection and try again.");
      else if (code === "auth/too-many-requests") setError("Too many requests. Wait a minute, then try again.");
      else if (code === "auth/invalid-email") setFieldError("Enter a valid email address.");
      else setSentTo(address);
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sentTo ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.medium, ease: ease.out }}
        >
          <AuthHeading
            title={
              <>
                Check your <em>inbox</em>
              </>
            }
            lede={
              <>
                If an account exists for <span className="text-text">{sentTo}</span>, a reset link is on its way. It can
                take a minute, and sometimes lands in spam.
              </>
            }
          />
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Button asChild size="lg">
              <Link href="/signin">Back to sign in</Link>
            </Button>
            <button type="button" onClick={() => setSentTo(null)} className="link-draw text-meta text-muted hover:text-text">
              Use a different email
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="form" exit={{ opacity: 0, y: -8, transition: { duration: duration.micro } }}>
          <AuthHeading title="Reset your password" lede="Enter the email you signed up with and we’ll send a link to choose a new password." />
          <form noValidate onSubmit={onSubmit} className="mt-10 space-y-6">
            <Field
              ref={emailRef}
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldError}
            />
            <FormError message={error} />
            <Button type="submit" size="lg" className="w-full" pending={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="mt-7 text-meta text-muted">
            Remembered it?{" "}
            <Link href="/signin" className="link-draw text-text">
              Sign in
            </Link>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
