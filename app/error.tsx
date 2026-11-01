"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

/** Any segment's error boundary: the reel snapped, and we say so plainly. */
export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page relative flex min-h-[100svh] flex-col justify-between overflow-hidden py-8">
      <span
        aria-hidden="true"
        className="flicker pointer-events-none absolute -top-1/4 left-1/2 h-[120svh] w-[70vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_62%)]"
      />
      <Link href="/" aria-label="Reverie, home" className="relative self-start">
        <Logo />
      </Link>
      <div className="relative">
        <p className="caption text-muted">Interruption</p>
        <h1 className="flicker mt-4 max-w-[11ch] text-h1">The reel snapped.</h1>
        <p className="mt-6 max-w-[44ch] text-muted">
          Something went wrong on our side while loading this. Splicing it back together usually takes one try.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/">Back to the lobby</Link>
          </Button>
        </div>
      </div>
      <span />
    </main>
  );
}
