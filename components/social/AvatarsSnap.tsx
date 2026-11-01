"use client";

import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/social/people";

type Face = Pick<Person, "name" | "photoURL"> & { avatar: Person["avatar"] | null };

/**
 * Two people becoming friends: their avatars come in from either side and snap together,
 * overlapping a little, with a soft bump on contact. Still and overlapped under reduced motion.
 */
export function AvatarsSnap({ a, b, size = 56, delay = 0, className }: { a: Face; b: Face; size?: number; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  const overlap = Math.round(size * 0.22);
  const travel = size * 0.9;
  const snap = { type: "spring", stiffness: 520, damping: 26, mass: 0.9, delay } as const;
  return (
    <span aria-hidden="true" className={cn("relative inline-flex items-center", className)} style={{ height: size }}>
      <motion.span
        className="relative z-[1] rounded-full ring-2 ring-[var(--color-bg)]"
        initial={reduced ? false : { x: -travel, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={snap}
      >
        <Avatar name={a.name} photoURL={a.photoURL} avatar={a.avatar} size={size} />
      </motion.span>
      <motion.span
        className="relative rounded-full ring-2 ring-[var(--color-bg)]"
        style={{ marginLeft: -overlap }}
        initial={reduced ? false : { x: travel, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={snap}
      >
        <Avatar name={b.name} photoURL={b.photoURL} avatar={b.avatar} size={size} />
      </motion.span>
      {/* The bump where they meet. */}
      {reduced ? null : (
        <motion.span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border border-accent"
          style={{ left: size - overlap / 2 - 10, width: 20, height: 20 }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 2.6], opacity: [0, 0.7, 0] }}
          transition={{ duration: 0.7, delay: delay + 0.28, ease: "easeOut" }}
        />
      )}
    </span>
  );
}
