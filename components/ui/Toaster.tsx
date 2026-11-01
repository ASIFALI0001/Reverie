"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { useToastStore, type Toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

const LIFETIME_MS = 4800;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--dock-h)+env(safe-area-inset-bottom,0px)+0.75rem)] z-[90] flex justify-center px-4 md:bottom-8"
    >
      <ol aria-live="polite" aria-relevant="additions" className="flex w-full max-w-sm flex-col items-stretch gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    timer.current = setTimeout(() => dismiss(toast.id), LIFETIME_MS);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  useEffect(() => {
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // A list item stays a list item: the list itself is the polite live region that reads new
    // toasts out; errors also get an assertive alert inside.
    <motion.li
      layout
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } }}
      transition={spring.soft}
      onPointerEnter={stop}
      onPointerLeave={start}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-[var(--radius-panel)] border bg-raised px-4 py-3",
        toast.tone === "error" ? "border-danger/50" : "border-hairline-strong",
      )}
    >
      <div className="min-w-0 flex-1" role={toast.tone === "error" ? "alert" : undefined}>
        <p className="text-[0.9375rem] leading-snug text-text">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-meta text-muted">{toast.description}</p> : null}
      </div>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            dismiss(toast.id);
          }}
          className="link-draw shrink-0 text-[0.875rem] font-medium text-accent"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="-mr-1 grid size-6 shrink-0 place-items-center text-muted hover:text-text"
      >
        <X size={14} weight="light" />
      </button>
    </motion.li>
  );
}
