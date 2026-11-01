import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium select-none " +
  "transition-[background-color,color,border-color,transform] duration-200 ease-out active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  // Off-white plate that warms to tungsten on hover — the lamp coming up.
  primary: "bg-text text-bg hover:bg-accent hover:text-accent-ink",
  secondary: "border border-hairline-strong text-text hover:border-text/45 hover:bg-text/[0.04]",
  ghost: "text-muted hover:text-text",
  accent: "bg-accent text-accent-ink hover:bg-text hover:text-bg",
  danger: "border border-danger/60 text-danger hover:bg-danger hover:text-bg",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.875rem]",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-7 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Render as the child element (e.g. a Next <Link>) while keeping button styling. */
  asChild?: boolean;
  /** Working state: a projector beam sweeps the plate (no spinners in this house). */
  pending?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", asChild = false, pending = false, className, type, disabled, children, ...props },
  ref,
) {
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(base, variants[variant], sizes[size], pending && "overflow-hidden disabled:opacity-100", className)}
      {...props}
    >
      {children}
      {pending ? <span aria-hidden="true" className="beam" /> : null}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { "aria-label": string }>(
  function IconButton({ className, asChild = false, type, ...props }, ref) {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(
          "inline-grid size-11 place-items-center rounded-full border border-hairline-strong text-text",
          "transition-[background-color,border-color,transform] duration-200 ease-out hover:border-text/45 hover:bg-text/[0.05] active:scale-[0.94]",
          "disabled:pointer-events-none disabled:opacity-40",
          className,
        )}
        {...props}
      />
    );
  },
);
