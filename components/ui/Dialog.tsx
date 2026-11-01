"use client";

import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { duration, ease, spring } from "@/lib/motion";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (it stays available to screen readers). */
  hideTitle?: boolean;
  description?: string;
  children: ReactNode;
  className?: string;
  /** "panel" is a centred sheet; "cinema" is near-full-screen on a deep backdrop (trailers). */
  variant?: "panel" | "cinema";
};

export function Dialog({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  children,
  className,
  variant = "panel",
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={cn(
                  "fixed inset-0 z-[80] backdrop-blur-md",
                  variant === "cinema" ? "bg-black/85" : "bg-bg/70",
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.small, ease: ease.out }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[81] grid place-items-center p-4 md:p-8">
              {/* Without a description, an explicit undefined tells Radix the omission is intentional. */}
              <DialogPrimitive.Content asChild forceMount {...(description ? {} : { "aria-describedby": undefined })}>
                <motion.div
                  data-lenis-prevent
                  className={cn(
                    "pointer-events-auto relative max-h-[90dvh] w-full overflow-y-auto focus-visible:outline-none",
                    variant === "panel" &&
                      "max-w-lg rounded-[var(--radius-panel)] border border-hairline bg-surface p-6 md:p-8",
                    variant === "cinema" && "max-w-[min(92vw,1400px)]",
                    className,
                  )}
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.99, transition: { duration: duration.micro } }}
                  transition={spring.soft}
                >
                  <DialogPrimitive.Title className={cn("font-display text-h4", hideTitle && "sr-only")}>
                    {title}
                  </DialogPrimitive.Title>
                  {description ? (
                    <DialogPrimitive.Description className="mt-2 text-muted">{description}</DialogPrimitive.Description>
                  ) : null}
                  {children}
                  <DialogPrimitive.Close
                    aria-label="Close"
                    className={cn(
                      "absolute grid size-10 place-items-center rounded-full text-muted transition-colors hover:text-text",
                      variant === "cinema" ? "-top-12 right-0 text-text/80" : "right-3 top-3",
                    )}
                  >
                    <X size={20} weight="light" />
                  </DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
