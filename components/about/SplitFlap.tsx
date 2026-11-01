"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * A split-flap counter, like an old departures board: when a digit changes, the old one's top
 * half folds down and the new one's bottom half drops into place. Instant with reduced motion.
 */
export function SplitFlap({ value, className }: { value: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex gap-[3px]", className)}>
      {value.split("").map((ch, i) => (
        <Flap key={i} ch={ch} />
      ))}
    </span>
  );
}

const DUR = 0.16;

function Flap({ ch }: { ch: string }) {
  const reduced = useReducedMotion();
  const [state, setState] = useState({ cur: ch, prev: ch, n: 0 });
  const [settled, setSettled] = useState(0);
  // A new digit: remember the old one for the flip (adjusting state from a prop, during render).
  if (state.cur !== ch) setState({ cur: ch, prev: state.cur, n: state.n + 1 });
  const flipping = !reduced && state.n !== settled;

  return (
    <span className="relative inline-block h-[1.5em] w-[1.05em] rounded-[3px] bg-raised font-mono text-text [perspective:240px]">
      <Half ch={state.cur} part="top" />
      <Half ch={flipping ? state.prev : state.cur} part="bottom" />
      {flipping ? (
        <>
          <motion.span key={`top-${state.n}`} className="absolute inset-x-0 top-0 h-1/2 origin-bottom [backface-visibility:hidden]" initial={{ rotateX: 0 }} animate={{ rotateX: -90 }} transition={{ duration: DUR, ease: "easeIn" }}>
            <Half ch={state.prev} part="top" fill />
          </motion.span>
          <motion.span
            key={`bottom-${state.n}`}
            className="absolute inset-x-0 bottom-0 h-1/2 origin-top [backface-visibility:hidden]"
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{ duration: DUR, ease: "easeOut", delay: DUR }}
            onAnimationComplete={() => setSettled(state.n)}
          >
            <Half ch={state.cur} part="bottom" fill />
          </motion.span>
        </>
      ) : null}
      {/* The hinge. */}
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-bg/70" />
    </span>
  );
}

/** One half of a digit: the tile's top or bottom half, showing that half of the character. */
function Half({ ch, part, fill = false }: { ch: string; part: "top" | "bottom"; fill?: boolean }) {
  return (
    <span className={cn("absolute inset-x-0 h-1/2 overflow-hidden rounded-[3px] bg-raised", fill ? "inset-y-0 h-full" : part === "top" ? "top-0" : "bottom-0")}>
      <span className={cn("absolute inset-x-0 flex h-[200%] items-center justify-center leading-none", part === "top" ? "top-0" : "-top-full")}>{ch}</span>
    </span>
  );
}
