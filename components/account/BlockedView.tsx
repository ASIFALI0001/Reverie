"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiClientError } from "@/lib/api/client";

type Status =
  | { blocked: false; supportEmail: string | null }
  | { blocked: true; reason: string | null; at: string | null; until: string | null; supportEmail: string | null };

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Where a blocked account lands, and the only place it can reach. Calm and plain: what
 * happened, when, until when, the reason if the administrator chose to share it, and
 * where to appeal. The logo slowly dims over the grain; nothing else moves.
 */
export function BlockedView() {
  const { status: auth, signOut } = useAuth();
  const status = useQuery({
    queryKey: ["me", "status"],
    queryFn: () => api<Status>("/api/users/me/status"),
    enabled: auth === "signed-in",
    retry: false,
  });
  const signedOut = auth === "signed-out" || (status.error instanceof ApiClientError && status.error.status === 401);
  const s = status.data;

  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] px-[var(--page-x)] py-8 md:py-10">
      <div className="dim-slow">
        <Logo size={24} />
      </div>
      <section aria-labelledby="blocked-title" className="self-center py-16 md:max-w-[40rem] md:py-24">
        {signedOut ? (
          <>
            <p className="caption text-muted">Account status</p>
            <h1 id="blocked-title" className="mt-3 text-h2">
              You’re signed out.
            </h1>
            <p className="mt-6 text-muted">
              <Link href="/signin" className="link-draw text-text">
                Sign in
              </Link>{" "}
              to see your account’s status.
            </p>
          </>
        ) : !s ? (
          <div aria-hidden="true">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-14 w-full max-w-[30rem]" />
            <Skeleton className="mt-3 h-14 w-3/4 max-w-[22rem]" />
            <Skeleton className="mt-10 h-4 w-64" />
          </div>
        ) : s.blocked ? (
          <>
            <p className="caption text-muted">Account status</p>
            <h1 id="blocked-title" className="mt-3 text-h2">
              Your account has been blocked by an administrator.
            </h1>
            <div className="mt-10 space-y-5 text-[1.0625rem]">
              {s.at ? <p className="text-muted">Since {longDate(s.at)}.</p> : null}
              {s.reason ? (
                <blockquote className="border-l border-hairline-strong pl-5">
                  <p className="caption text-muted">Reason given</p>
                  <p className="mt-1.5 text-text">{s.reason}</p>
                </blockquote>
              ) : null}
              {s.until ? (
                <p className="text-text">You can return after {longDate(s.until)}.</p>
              ) : (
                <p className="text-muted">Your library and taste profile are kept as they are.</p>
              )}
              {s.supportEmail ? (
                <p className="text-muted">
                  If you think this is a mistake, write to{" "}
                  <a href={`mailto:${s.supportEmail}?subject=${encodeURIComponent("Reverie account review")}`} className="link-draw text-text">
                    {s.supportEmail}
                  </a>
                  .
                </p>
              ) : null}
            </div>
            <Button variant="secondary" className="mt-12" onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <p className="caption text-muted">Account status</p>
            <h1 id="blocked-title" className="mt-3 text-h2">
              Your account is in good standing.
            </h1>
            <p className="mt-6 text-muted">
              Nothing to see here.{" "}
              <Link href="/" className="link-draw text-text">
                Back to Reverie
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
