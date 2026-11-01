"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { MOOD_PRESETS } from "@/lib/mood/target";
import { ease } from "@/lib/motion";

const FEATURED = ["light-fun", "edge-of-seat", "good-cry", "make-me-think", "scare-me", "comfort-rewatch"];

/** Home: "Not sure what to watch? Tell me your mood." — one tap straight to the time step. */
export function MoodCard() {
  const reduced = useReducedMotion();
  const moods = FEATURED.map((id) => MOOD_PRESETS.find((p) => p.id === id)!);
  return (
    <motion.section
      aria-labelledby="mood-card"
      className="page py-[calc(var(--section-y)*0.4)]"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: ease.out }}
    >
      <div className="relative overflow-hidden rounded-[6px] border border-hairline-strong bg-surface p-6 md:p-10">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(232 162 58 / 0.22), transparent 65%)" }}
        />
        <div className="relative grid grid-cols-1 items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="caption">Mood</p>
            <h2 id="mood-card" className="mt-2 max-w-[18ch] font-display text-h2">
              Not sure what to watch? Tell me your mood.
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {moods.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/mood?preset=${m.id}`}
                    className="inline-flex h-9 items-center rounded-full border border-hairline-strong px-4 text-[0.875rem] text-muted transition-colors hover:border-text/40 hover:text-text"
                  >
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/mood" className="link-draw inline-flex items-center gap-2 text-[1.0625rem] text-text">
            All the moods <ArrowRight size={18} weight="light" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
