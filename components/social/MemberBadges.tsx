"use client";

import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { matchColor } from "@/lib/match-color";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/social/people";

type Badge = { person: Pick<Person, "uid" | "name" | "photoURL" | "avatar">; match: number | null };

const ARC = 2 * Math.PI * 11;

/**
 * Every member's own match for a title, as small avatar badges. They drop in and stack on a
 * spring, overlapped; hovering or focusing the card fans them out so each number reads clearly.
 */
export function MemberBadges({ badges, className }: { badges: Badge[]; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <ul
      aria-label="Each member’s match"
      className={cn("flex items-center -space-x-1.5 transition-[gap] group-hover/card:space-x-1 group-focus-within/card:space-x-1", className)}
    >
      {badges.map((b, i) => (
        <motion.li
          key={b.person.uid}
          layout={!reduced}
          initial={reduced ? false : { opacity: 0, y: -10, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.8, delay: reduced ? 0 : 0.08 + i * 0.07 }}
          className="relative flex items-center gap-1 rounded-full bg-bg/90 py-0.5 pl-0.5 pr-2 ring-1 ring-hairline-strong"
          style={{ zIndex: badges.length - i }}
        >
          {/* The avatar wears its match as an arc; the number stays in text ink. */}
          <span aria-hidden="true" className="relative grid size-6 place-items-center">
            <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
              <circle cx="12" cy="12" r="11" fill="none" stroke="var(--color-hairline-strong)" strokeWidth="1.5" />
              {b.match != null ? (
                <circle
                  cx="12"
                  cy="12"
                  r="11"
                  fill="none"
                  stroke={matchColor(b.match)}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${(b.match / 100) * ARC} ${ARC}`}
                />
              ) : null}
            </svg>
            <Avatar name={b.person.name} photoURL={b.person.photoURL} avatar={b.person.avatar} size={18} />
          </span>
          <span aria-hidden="true" className="numeral text-[0.6875rem] leading-none text-text">
            {b.match != null ? b.match : "–"}
          </span>
          <span className="sr-only">
            {b.person.name}: {b.match != null ? `${b.match}% match` : "no match yet"}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}
