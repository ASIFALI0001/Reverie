import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Magnetic } from "@/components/motion/Magnetic";

export default function NotFound() {
  return (
    <main className="page relative flex min-h-[100svh] flex-col justify-between overflow-hidden py-8">
      {/* The projector's beam, flickering over an empty screen. */}
      <span
        aria-hidden="true"
        className="flicker pointer-events-none absolute -top-1/4 left-1/2 h-[120svh] w-[70vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_62%)]"
      />
      <Link href="/" aria-label="Reverie, home" className="relative self-start">
        <Logo />
      </Link>
      <div className="relative">
        <p className="numeral text-meta text-muted">404</p>
        <h1 className="flicker mt-4 max-w-[10ch] text-h1">This reel is missing.</h1>
        <p className="mt-6 max-w-[42ch] text-muted">
          The page you asked for isn’t in the projection booth. It may have moved, or the link was mistyped.
        </p>
        <Magnetic className="mt-10">
          <Button asChild size="lg">
            <Link href="/">Back to the lobby</Link>
          </Button>
        </Magnetic>
      </div>
      <span />
    </main>
  );
}
