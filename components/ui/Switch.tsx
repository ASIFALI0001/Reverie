"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/** An on/off setting: a labelled row with a small lamp switch (the knob glides, the track warms). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[1.0625rem]">
          {label}
        </label>
        {description ? (
          <p id={`${id}-d`} className="mt-1 max-w-[52ch] text-meta text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40",
          checked ? "border-accent bg-accent" : "border-hairline-strong bg-text/[0.06]",
        )}
      >
        <motion.span
          aria-hidden="true"
          className={cn("block size-5 rounded-full", checked ? "bg-accent-ink" : "bg-text/70")}
          initial={false}
          animate={{ x: checked ? 24 : 3 }}
          transition={spring.snappy}
        />
      </button>
    </div>
  );
}
