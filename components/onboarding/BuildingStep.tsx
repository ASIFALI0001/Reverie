"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UsersThree } from "@phosphor-icons/react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Button } from "@/components/ui/Button";
import { MaskHeading } from "@/components/onboarding/StepFrame";
import { TasteDnaCard } from "@/components/taste/TasteDnaCard";
import { useSubmitOnboarding } from "@/lib/api/taste";
import { useMe } from "@/lib/api/me";
import { toSubmission, useOnboarding } from "@/lib/store/onboarding";
import { tmdbImg } from "@/lib/images/tmdb";
import { ease } from "@/lib/motion";
import type { TasteView } from "@/lib/taste/types";
import { afterOnboarding } from "@/lib/social/pending-invite";

/** The swirl's length; the reveal waits for both this and the server. */
const SWIRL_S = 3.4;
const LINES = ["Weighing what you loved", "Reading between the genres", "Tuning your match dial", "Almost there"];

type Phase = { kind: "building" } | { kind: "reveal"; taste: TasteView | null } | { kind: "error"; message: string };

export function BuildingStep() {
  const router = useRouter();
  const submit = useSubmitOnboarding();
  const swipes = useOnboarding((s) => s.swipes);
  const favourites = useOnboarding((s) => s.favourites);
  const reset = useOnboarding((s) => s.reset);
  const go = useOnboarding((s) => s.go);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ kind: "building" });
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  // Favourites first, then what they loved; fill with anything swiped so the ring is never sparse.
  const posters = useMemo(() => {
    const picked = [...favourites.map((f) => f.posterPath), ...swipes.filter((s) => s.verdict === "loved").map((s) => s.posterPath)];
    const filler = swipes.map((s) => s.posterPath);
    return [...new Set([...picked, ...filler].filter((p): p is string => !!p))].slice(0, 10);
  }, [favourites, swipes]);

  const { mutateAsync } = submit;
  useEffect(() => {
    if (started.current === attempt) return; // once per attempt (Strict Mode re-runs effects)
    started.current = attempt;
    const minimum = new Promise((r) => setTimeout(r, reduced ? 900 : SWIRL_S * 1000 + 300));
    Promise.all([mutateAsync(toSubmission(useOnboarding.getState())), minimum])
      .then(([res]) => setPhase({ kind: "reveal", taste: res.taste }))
      .catch((err: unknown) => setPhase({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." }));
  }, [attempt, mutateAsync, reduced]);

  function finish() {
    reset();
    router.replace(afterOnboarding());
    router.refresh();
  }

  return (
    <AnimatePresence mode="wait">
      {phase.kind === "building" ? (
        <motion.section
          key="building"
          className="relative flex flex-1 flex-col items-center justify-center overflow-hidden py-10"
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          aria-busy="true"
        >
          <h1 className="sr-only">Building your taste…</h1>
          {reduced ? <QuietBuild /> : <Swirl posters={posters} />}
        </motion.section>
      ) : phase.kind === "reveal" ? (
        <motion.section
          key="reveal"
          className="flex flex-1 flex-col pt-6 md:pt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <MaskHeading className="text-h1">
            Here’s your <em>taste.</em>
          </MaskHeading>
          <div className="mt-10 flex-1 pb-10">
            {phase.taste && phase.taste.dna.length ? (
              <TasteDnaCard view={phase.taste} />
            ) : (
              <p className="max-w-[48ch] text-lead text-muted">
                Your answers are saved. The profile is still being put together; your home page will use it as soon as it’s ready.
              </p>
            )}
            <TwinsNote />
          </div>
          {/* Same footer as the steps, so the way on is always in reach. */}
          <div className="sticky bottom-0 z-20 -mx-[var(--page-x)] border-t border-hairline bg-bg/92 px-[var(--page-x)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-sm">
            <motion.div
              className="flex items-center justify-between gap-4"
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: ease.out, delay: 1.1 }}
            >
              <Button variant="ghost" onClick={() => go("formats")}>
                Change my answers
              </Button>
              <Button onClick={finish}>See what to watch</Button>
            </motion.div>
          </div>
        </motion.section>
      ) : (
        <motion.section key="error" className="my-auto max-w-xl py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-h2">That didn’t save.</h1>
          <p className="mt-4 text-muted">{phase.message}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setPhase({ kind: "building" });
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
            <Button variant="ghost" onClick={() => go("quick")}>
              Back
            </Button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** Taste Twins is on by default, so say so here, plainly, with the way out. */
function TwinsNote() {
  const me = useMe();
  if (!me.data?.privacy.inTwins) return null;
  return (
    <p className="mt-8 flex max-w-[60ch] gap-3 text-meta text-muted">
      <UsersThree size={18} weight="light" aria-hidden="true" className="mt-0.5 shrink-0 text-text" />
      <span>
        You’re in Taste Twins: Reverie can introduce you, anonymously, to people whose taste is close to yours. Nothing that identifies you is shown unless you both choose to
        connect, and titles you hide from friends never count.{" "}
        <Link href="/settings#privacy" className="link-draw text-text">
          Change this in Settings
        </Link>
        .
      </span>
    </p>
  );
}

type Orbit = { rx: number; ry: number };

/** Posters orbit and spiral into one warm point while a film leader counts down. */
function Swirl({ posters }: { posters: string[] }) {
  const progress = useMotionValue(0);
  const stage = useRef<HTMLDivElement>(null);
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  const [count, setCount] = useState(3);
  const [line, setLine] = useState(0);

  useEffect(() => {
    // An ellipse sized to the stage, so no poster ever leaves it (or covers the caption).
    const measure = () => {
      const box = stage.current?.getBoundingClientRect();
      if (!box) return;
      const w = Math.min(Math.max(72, window.innerWidth * 0.11), 120);
      setOrbit({ rx: Math.min(box.width / 2 - w / 2 - 8, 420), ry: Math.max(60, box.height / 2 - (w * 1.5) / 2 - 8) });
    };
    measure();
    window.addEventListener("resize", measure);
    const spin = animate(progress, 1, { duration: SWIRL_S, ease: [0.5, 0, 0.75, 0.4] });
    const tick = setInterval(() => setCount((c) => (c > 1 ? c - 1 : c)), (SWIRL_S * 1000) / 3);
    const words = setInterval(() => setLine((l) => Math.min(l + 1, LINES.length - 1)), 1100);
    return () => {
      spin.stop();
      clearInterval(tick);
      clearInterval(words);
      window.removeEventListener("resize", measure);
    };
  }, [progress]);

  const glowScale = useTransform(progress, [0, 1], [0.25, 1]);
  const glowOpacity = useTransform(progress, [0, 0.6, 1], [0.15, 0.55, 1]);
  const leaderOpacity = useTransform(progress, [0, 0.75, 0.95], [1, 1, 0]);

  return (
    <>
      <div ref={stage} aria-hidden="true" className="relative h-[min(62svh,36rem)] w-full max-w-5xl">
        <motion.div
          className="absolute left-1/2 top-1/2 size-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_85%,white),color-mix(in_oklab,var(--color-accent)_45%,transparent)_45%,transparent)] blur-[6px]"
          style={{ scale: glowScale, opacity: glowOpacity }}
        />
        {orbit
          ? posters.map((path, i) => <OrbitPoster key={path} path={path} index={i} total={posters.length} orbit={orbit} progress={progress} />)
          : null}
        <motion.div className="absolute left-1/2 top-1/2 z-[200] -translate-x-1/2 -translate-y-1/2" style={{ opacity: leaderOpacity }}>
          <Leader count={count} />
        </motion.div>
      </div>
      <div className="mt-8 h-14 text-center">
        <p className="font-display text-h3">Building your taste…</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            className="mt-1 text-meta text-muted"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {LINES[line]}
          </motion.p>
        </AnimatePresence>
      </div>
    </>
  );
}

function OrbitPoster({
  path,
  index,
  total,
  orbit,
  progress,
}: {
  path: string;
  index: number;
  total: number;
  orbit: Orbit;
  progress: MotionValue<number>;
}) {
  const start = (index / Math.max(total, 1)) * Math.PI * 2;
  // A tilted ring, tightening as it turns: the far side (top) is smaller and dimmer and passes
  // behind the near side. Posters stay upright and shrink into the light.
  const place = (p: number) => {
    const k = Math.pow(1 - p, 1.5);
    const a = start + p * 7;
    return { x: Math.cos(a) * orbit.rx * k, y: Math.sin(a) * orbit.ry * k, near: (Math.sin(a) + 1) / 2 };
  };
  const transform = useTransform(progress, (p) => {
    const { x, y, near } = place(p);
    return `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${((1 - 0.8 * p) * (0.8 + 0.2 * near)).toFixed(3)})`;
  });
  const zIndex = useTransform(progress, (p) => Math.round(place(p).near * 100));
  const opacity = useTransform(progress, [0, 0.08, 0.8, 1], [0, 1, 0.9, 0]);
  const filter = useTransform(progress, (p) => `blur(${(p * 5).toFixed(2)}px) brightness(${(0.65 + 0.35 * place(p).near + p * 0.6).toFixed(2)})`);
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 aspect-[2/3] w-[clamp(4.5rem,11vw,7.5rem)] overflow-hidden rounded-[2px] shadow-[0_20px_40px_-16px_rgb(0_0_0/0.8)]"
      style={{ transform, opacity, filter, zIndex }}
    >
      <Image src={tmdbImg(path, "thumb")!} alt="" fill sizes="120px" className="object-cover" />
    </motion.div>
  );
}

/** A film leader: crosshair, a sweeping hand, the count. */
function Leader({ count }: { count: number }) {
  return (
    <div className="relative grid size-36 place-items-center rounded-full border border-text/35 bg-bg/40 backdrop-blur-[2px]">
      <span className="absolute inset-x-0 top-1/2 h-px bg-text/20" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-text/20" />
      <span className="absolute inset-3 rounded-full border border-text/15" />
      <motion.span
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_290deg,color-mix(in_oklab,var(--color-accent)_45%,transparent)_360deg)]"
        animate={{ rotate: 360 }}
        transition={{ duration: SWIRL_S / 3, ease: "linear", repeat: Infinity }}
      />
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          className="relative font-display text-[4.5rem] leading-none"
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25 }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function QuietBuild() {
  return (
    <div className="text-center">
      <p className="font-display text-h2">Building your taste…</p>
      <div className="relative mx-auto mt-6 h-px w-48 overflow-hidden bg-hairline-strong">
        <span className="beam" />
      </div>
    </div>
  );
}
