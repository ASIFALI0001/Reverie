"use client";

import { motion, useReducedMotion } from "motion/react";
import { TasteRadar } from "@/components/taste/TasteRadar";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { TasteView } from "@/lib/taste/types";

/** The Taste DNA: 3–4 phrases set large, the summary, and the genre radar. */
export function TasteDnaCard({
  view,
  compact = false,
  animate = true,
  label = "Your Taste DNA",
}: {
  view: TasteView;
  compact?: boolean;
  animate?: boolean;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const reveal = animate && !reduced;
  return (
    <div
      className={cn(
        "grid items-start gap-10",
        compact ? "md:grid-cols-[minmax(0,1fr)_16rem]" : "lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16",
      )}
    >
      <div>
        <p className="caption text-muted">{label}</p>
        <ul className="mt-4 border-t border-hairline">
          {view.dna.map((phrase, i) => (
            <li key={phrase} className="overflow-hidden border-b border-hairline py-3">
              <motion.span
                className={cn("block font-display leading-[1.08]", compact ? "text-h4" : "text-[clamp(1.875rem,3.6vw,2.75rem)]")}
                initial={reveal ? { y: "105%" } : false}
                animate={{ y: 0 }}
                transition={{ duration: 0.85, ease: ease.out, delay: 0.2 + i * 0.12 }}
              >
                {phrase}
              </motion.span>
            </li>
          ))}
        </ul>
        {view.summary ? (
          <motion.p
            className={cn("mt-6 max-w-[60ch] leading-relaxed text-muted", compact ? "text-body" : "text-[1.0625rem] md:text-[1.125rem]")}
            initial={reveal ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 + view.dna.length * 0.12 }}
          >
            {view.summary}
          </motion.p>
        ) : null}
      </div>
      <TasteRadar points={view.radar} animate={animate} className={cn("mx-auto", compact ? "max-w-[16rem]" : "max-w-[22rem]")} />
    </div>
  );
}
