"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/cn";

const LABEL: Record<string, string> = { view: "View", play: "Play", drag: "Drag" };
const SIZE = 76;

/**
 * The cue mark: a small dot that trails the pointer and, over a poster, trailer or
 * rail, grows into a labelled disc. Desktop pointers only, and off with reduced
 * motion. The real cursor stays; this is a companion, not a replacement.
 */
export function Cursor() {
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const reduced = useReducedMotion();
  return fine && !reduced ? <CueMark /> : null;
}

function CueMark() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  // A touch of lag, like a reflection catching up.
  const sx = useSpring(x, { stiffness: 620, damping: 46, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 620, damping: 46, mass: 0.35 });
  const [kind, setKind] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [down, setDown] = useState(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      setShown(true);
    };
    const over = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.("[data-cursor]");
      setKind(target?.getAttribute("data-cursor") ?? null);
    };
    const leave = () => setShown(false);
    const press = () => setDown(true);
    const release = () => setDown(false);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
    };
  }, [x, y]);

  const label = kind ? (LABEL[kind] ?? null) : null;
  return (
    <motion.div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[300]" style={{ x: sx, y: sy }}>
      <motion.div
        className={cn(
          "grid place-items-center rounded-full",
          label ? "bg-accent text-accent-ink" : "bg-text mix-blend-difference",
        )}
        style={{ width: SIZE, height: SIZE, marginLeft: -SIZE / 2, marginTop: -SIZE / 2 }}
        initial={false}
        animate={{ scale: (label ? 1 : 8 / SIZE) * (down ? 0.86 : 1), opacity: shown ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        <AnimatePresence>
          {label ? (
            <motion.span
              key={label}
              className="text-[0.75rem] font-medium tracking-[0.04em]"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {label}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
