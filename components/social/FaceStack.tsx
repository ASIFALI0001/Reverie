"use client";

import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/social/people";

/** A few overlapping avatars, dropping in one after another. Decorative: the text beside it names them. */
export function FaceStack({ people, size = 28, max = 4, className }: { people: Pick<Person, "uid" | "name" | "photoURL" | "avatar">[]; size?: number; max?: number; className?: string }) {
  const reduced = useReducedMotion();
  const shown = people.slice(0, max);
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center", className)}>
      {shown.map((p, i) => (
        <motion.span
          key={p.uid}
          className="rounded-full ring-2 ring-[var(--color-bg)]"
          style={{ marginLeft: i ? -Math.round(size * 0.3) : 0, zIndex: shown.length - i }}
          initial={reduced ? false : { opacity: 0, y: -6, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 24, delay: reduced ? 0 : i * 0.06 }}
        >
          <Avatar name={p.name} photoURL={p.photoURL} avatar={p.avatar} size={size} />
        </motion.span>
      ))}
    </span>
  );
}
