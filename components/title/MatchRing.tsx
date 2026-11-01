"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { matchColor } from "@/lib/match-color";

// Engraved dial: a tick every 2%, longer every 10% — like the scale on a lens barrel.
const DIAL = Array.from({ length: 50 }, (_, i) => {
  const major = i % 5 === 0;
  const a = (i / 50) * Math.PI * 2 - Math.PI / 2;
  const r1 = major ? 52.2 : 53.6;
  const r2 = 55;
  return `M${(60 + Math.cos(a) * r1).toFixed(2)} ${(60 + Math.sin(a) * r1).toFixed(2)}L${(60 + Math.cos(a) * r2).toFixed(2)} ${(60 + Math.sin(a) * r2).toFixed(2)}`;
}).join("");

type MatchRingProps = {
  value: number;
  label?: string;
  /** Shown under the ring, e.g. "Getting to know you" while confidence is low. */
  note?: string;
  delay?: number;
  className?: string;
};

/** The hero's focal point: a thin dial whose arc draws on reveal while the number counts up. */
/**
 * The dial itself, drawn from a 0–100 motion value: the arc, its colour temperature and the
 * number all follow it. MatchRing animates the value; the About story scrubs it with scroll.
 */
export function MatchDialFace({ progress, label }: { progress: MotionValue<number>; label: string }) {
  const arc = useTransform(progress, (v) => v / 100);
  const shown = useTransform(progress, (v) => Math.round(v));
  const stroke = useTransform(progress, (v) => matchColor(v));
  return (
    <>
      <div aria-hidden="true" className="absolute inset-[4%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-bg)_62%,transparent),transparent)]" />
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden="true">
        <path d={DIAL} stroke="var(--color-hairline-strong)" strokeWidth="0.45" fill="none" />
        <circle cx="60" cy="60" r="57.5" stroke="var(--color-hairline)" strokeWidth="0.5" fill="none" />
        <motion.circle
          cx="60"
          cy="60"
          r="57.5"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ pathLength: arc, stroke, rotate: -90, transformOrigin: "60px 60px" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span aria-hidden="true" className="numeral flex items-start font-extralight leading-[0.8] tracking-[-0.06em] text-text [font-size:42cqi]">
          <motion.span>{shown}</motion.span>
          <span className="ml-[0.04em] mt-[0.12em] text-[0.22em] font-light tracking-normal text-muted">%</span>
        </span>
        <span className="caption mt-[5cqi]">{label}</span>
      </div>
    </>
  );
}

export function MatchRing({ value, label = "match", note, delay = 0.25, className }: MatchRingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();
  const progress = useMotionValue(0);
  const target = Math.round(Math.min(99, Math.max(1, value)));

  useEffect(() => {
    if (!inView) return;
    if (ref.current) ref.current.dataset.countup = "ready";
    if (reduced) {
      progress.set(target);
      return;
    }
    const controls = animate(progress, target, { duration: 1.9, ease: ease.out, delay });
    return () => controls.stop();
  }, [inView, target, reduced, delay, progress]);

  return (
    <figure className={cn("w-[clamp(13rem,25vw,22.5rem)]", className)}>
      <div ref={ref} data-countup="" className="relative aspect-square [container-type:inline-size]">
        <MatchDialFace progress={progress} label={label} />
      </div>
      <figcaption className="sr-only">
        {target}% {label}
        {note ? `. ${note}` : ""}
      </figcaption>
      {note ? <p className="mt-3 text-center text-meta text-muted">{note}</p> : null}
    </figure>
  );
}

/**
 * The same dial with no reading yet (signed out, or still learning someone's
 * taste) — keeps the hero composition intact and says what unlocks it.
 */
export function MatchDialEmpty({ label = "match", note, loading = false, className }: { label?: string; note?: React.ReactNode; loading?: boolean; className?: string }) {
  return (
    <figure className={cn("w-[clamp(13rem,25vw,22.5rem)]", className)}>
      <div className={cn("relative aspect-square [container-type:inline-size]", loading && "animate-pulse")}>
        <div aria-hidden="true" className="absolute inset-[4%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-bg)_62%,transparent),transparent)]" />
        <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden="true">
          <path d={DIAL} stroke="var(--color-hairline-strong)" strokeWidth="0.45" fill="none" />
          <circle cx="60" cy="60" r="57.5" stroke="var(--color-hairline)" strokeWidth="0.5" fill="none" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span aria-hidden="true" className="numeral font-extralight leading-[0.8] text-faint [font-size:30cqi]">
            —
          </span>
          <span className="caption mt-[5cqi]">{label}</span>
        </div>
      </div>
      {note ? <figcaption className="mt-3 text-center text-meta text-muted">{note}</figcaption> : null}
    </figure>
  );
}

/** Mid-size dial for ranked lists. The arc re-draws when an estimate is refined. */
export function MatchMini({ value, label = "match", className }: { value: number; label?: string; className?: string }) {
  const v = Math.round(Math.min(99, Math.max(1, value)));
  return (
    <span className={cn("relative inline-grid size-[3.25rem] shrink-0 place-items-center", className)} role="img" aria-label={`${v}% ${label}`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r="21" fill="none" stroke="var(--color-hairline-strong)" strokeWidth="1.25" />
        <motion.circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke={matchColor(v)}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v / 100 }}
          transition={{ duration: 0.9, ease: ease.out }}
        />
      </svg>
      <span aria-hidden="true" className="numeral text-[0.9375rem] leading-none">
        {v}
        <span className="text-[0.62em] text-muted">%</span>
      </span>
    </span>
  );
}

/** Compact badge for poster cards and list rows: a tiny arc plus the number. */
export function MatchBadge({ value, className }: { value: number; className?: string }) {
  const v = Math.round(Math.min(99, Math.max(1, value)));
  const c = 2 * Math.PI * 5;
  return (
    <span
      className={cn(
        "numeral inline-flex items-center gap-1.5 rounded-full bg-bg/85 py-1 pl-1.5 pr-2.5 text-[0.75rem] leading-none text-text",
        className,
      )}
    >
      <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
        <circle cx="7" cy="7" r="5" fill="none" stroke="var(--color-hairline-strong)" strokeWidth="1.4" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          stroke={matchColor(v)}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform="rotate(-90 7 7)"
        />
      </svg>
      <span>
        {v}
        <span className="text-muted">%</span>
        <span className="sr-only"> match</span>
      </span>
    </span>
  );
}
