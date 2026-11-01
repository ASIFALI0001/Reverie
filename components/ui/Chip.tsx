"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type ChipProps = {
  selected?: boolean;
  onToggle?: (next: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** Trailing count, set in the mono face. */
  count?: number;
  disabled?: boolean;
};

/** Toggleable pill. Selection inverts the plate and gives a small spring "pop". */
export function Chip({ selected = false, onToggle, children, className, count, disabled }: ChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onToggle?.(!selected)}
      whileTap={{ scale: 0.94 }}
      initial={false}
      animate={{ scale: selected ? [1, 1.06, 1] : 1 }}
      transition={{ scale: { duration: 0.35, ease: ease.out } }}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[0.875rem] leading-none",
        "transition-[background-color,color,border-color] duration-200 ease-out disabled:opacity-40",
        selected
          ? "border-text bg-text text-bg"
          : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
        className,
      )}
    >
      <span>{children}</span>
      {count != null && (
        <span className={cn("numeral text-[0.75rem]", selected ? "text-bg/75" : "text-muted")}>{count}</span>
      )}
    </motion.button>
  );
}
