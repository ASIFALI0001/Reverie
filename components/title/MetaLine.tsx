import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** "2013 · 2h 10m · UA · Action, Sci-Fi" with properly spaced, de-emphasised separators. */
export function MetaLine({ items, className }: { items: (ReactNode | null | undefined | false)[]; className?: string }) {
  const parts = items.filter((p): p is ReactNode => p != null && p !== false && p !== "");
  return (
    <p className={cn("flex flex-wrap items-baseline gap-y-1 text-[0.9375rem] text-muted [font-variant-numeric:tabular-nums]", className)}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span aria-hidden="true" className="mx-2.5 text-faint">
              ·
            </span>
          )}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}
