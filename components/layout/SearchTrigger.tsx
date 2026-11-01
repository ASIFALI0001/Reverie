"use client";

import { useSyncExternalStore } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Kbd } from "@/components/ui/Kbd";
import { usePalette } from "@/lib/store/palette";
import { preloadPalette } from "@/components/search/CommandPalette";
import { cn } from "@/lib/cn";

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const noop = () => () => {};

/** Quiet field-shaped trigger for the ⌘K palette. */
export function SearchTrigger({ className }: { className?: string }) {
  const mac = useSyncExternalStore(noop, isMac, () => true);
  const setOpen = usePalette((s) => s.setOpen);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      onPointerEnter={preloadPalette}
      onFocus={preloadPalette}
      aria-haspopup="dialog"
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      className={cn(
        "group flex h-10 w-[19.5rem] items-center gap-2.5 rounded-full border border-hairline-strong px-4 text-left text-[0.875rem] text-muted",
        "transition-[border-color,color] duration-200 ease-out hover:border-text/40 hover:text-text",
        className,
      )}
    >
      <MagnifyingGlass size={16} weight="light" aria-hidden="true" />
      <span className="flex-1 truncate">Search, or describe a mood</span>
      <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
    </button>
  );
}
