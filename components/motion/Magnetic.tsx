"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/cn";

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

/** A primary action that leans a few pixels toward the pointer (desktop, motion allowed). */
export function Magnetic({ children, strength = 0.3, max = 10, className }: { children: ReactNode; strength?: number; max?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.6 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.6 });
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const reduced = useReducedMotion();
  const on = fine && !reduced;

  return (
    <motion.span
      ref={ref}
      className={cn("inline-block", className)}
      style={on ? { x, y } : undefined}
      onPointerMove={
        on
          ? (e) => {
              const r = ref.current!.getBoundingClientRect();
              x.set(clamp((e.clientX - (r.left + r.width / 2)) * strength, max));
              y.set(clamp((e.clientY - (r.top + r.height / 2)) * strength, max));
            }
          : undefined
      }
      onPointerLeave={
        on
          ? () => {
              x.set(0);
              y.set(0);
            }
          : undefined
      }
    >
      {children}
    </motion.span>
  );
}
