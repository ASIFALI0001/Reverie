"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

/** A heading that rises out of a mask (one block; onboarding headings are a line or two). */
export function MaskHeading({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <h1 className={cn("overflow-hidden pb-[0.08em]", className)}>
      <motion.span
        className="block"
        initial={reduced ? { opacity: 0 } : { y: "108%" }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: reduced ? 0.3 : 0.9, ease: ease.out }}
      >
        {children}
      </motion.span>
    </h1>
  );
}

/** Shared layout for each step: heading, lede, the step's game, and a sticky footer with the controls. */
export function StepFrame({
  title,
  lede,
  children,
  footer,
  className,
  compact = false,
}: {
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** A smaller heading, for steps whose game needs the height. */
  compact?: boolean;
}) {
  return (
    <section className={cn("flex flex-1 flex-col pt-4 md:pt-10", className)}>
      <MaskHeading className={cn("max-w-[20ch]", compact ? "text-h2" : "text-h1")}>{title}</MaskHeading>
      {lede ? (
        <motion.p
          className={cn("max-w-[48ch] text-muted", compact ? "mt-2 text-body" : "mt-4 text-lead")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          {lede}
        </motion.p>
      ) : null}
      <div className={cn("flex-1", compact ? "mt-6" : "mt-8 md:mt-12")}>{children}</div>
      {footer ? (
        <div className="sticky bottom-0 z-20 -mx-[var(--page-x)] mt-10 border-t border-hairline bg-bg/92 px-[var(--page-x)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">{footer}</div>
        </div>
      ) : null}
    </section>
  );
}
