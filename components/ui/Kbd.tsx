import { cn } from "@/lib/cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "numeral inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-hairline-strong px-1.5 text-[0.6875rem] leading-none text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
