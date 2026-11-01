"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

const WORD = "Reverie";

type MarkProps = { size?: number; animate?: boolean; className?: string };

// Markup never depends on the reduced-motion preference (the server can't know it);
// only durations do, so reduced motion lands on the final frame instantly.
const timing = (reduced: boolean | null, duration: number, delay = 0) =>
  reduced ? { duration: 0, delay: 0 } : { duration, delay, ease: ease.out };

/**
 * The mark: a lens ring with one aperture blade drawn back far enough to let
 * a crescent of tungsten light through. On first load the ring draws, then
 * the blade slides open.
 */
export function LogoMark({ size = 26, animate = false, className }: MarkProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduced = useReducedMotion();

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className={cn("shrink-0", className)}>
      <defs>
        <mask id={`blade-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect width="32" height="32" fill="white" />
          <motion.circle
            r="9.6"
            fill="black"
            initial={animate ? { cx: 16, cy: 16 } : false}
            animate={{ cx: 19.9, cy: 12.8 }}
            transition={timing(reduced, 0.95, 0.5)}
          />
        </mask>
      </defs>
      <motion.circle
        cx="16"
        cy="16"
        r="14.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        initial={animate ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={timing(reduced, 1.05)}
        style={{ rotate: -90, transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle cx="16" cy="16" r="9.6" fill="var(--color-accent)" mask={`url(#blade-${id})`} />
    </svg>
  );
}

type LogoProps = MarkProps & { wordmarkClassName?: string };

/** Mark + wordmark. Decorative: the surrounding link carries the accessible name. */
export function Logo({ size = 26, animate = false, className, wordmarkClassName }: LogoProps) {
  const reduced = useReducedMotion();

  return (
    <span aria-hidden="true" className={cn("inline-flex items-center gap-2.5 text-text", className)}>
      <LogoMark size={size} animate={animate} />
      <span className={cn("font-display text-[1.65rem] leading-none tracking-[-0.015em]", wordmarkClassName)}>
        {WORD.split("").map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={animate ? { opacity: 0, y: "0.4em" } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={timing(reduced, 0.75, 0.85 + i * 0.04)}
          >
            {ch}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
