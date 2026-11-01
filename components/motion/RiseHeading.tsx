import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A heading that rises out of a mask with CSS alone: no script, so it plays (and paints)
 * before anything hydrates. For first-screen heroes; SplitHeading does the line-by-line version.
 */
export function RiseHeading({ as: Tag = "h1", children, className, delay = 0 }: { as?: ElementType; children: ReactNode; className?: string; delay?: number }) {
  return (
    <Tag className={cn("overflow-hidden pb-[0.08em]", className)}>
      <span className="rise-in block" style={delay ? { animationDelay: `${delay}s` } : undefined}>
        {children}
      </span>
    </Tag>
  );
}
