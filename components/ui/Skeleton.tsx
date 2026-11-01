import { cn } from "@/lib/cn";

/** Shape-matched placeholder. Give it the exact box of the content it stands in for. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-[2px]", className)} style={style} />;
}
