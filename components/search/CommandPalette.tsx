"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePalette } from "@/lib/store/palette";

/** The dialog (cmdk + Radix) loads the first time someone opens the palette. */
const PaletteDialog = dynamic(() => import("@/components/search/PaletteDialog"), { ssr: false });

/** Warm the dialog's code ahead of a likely open (hovering the trigger). */
export function preloadPalette() {
  void import("@/components/search/PaletteDialog");
}

/** ⌘K / Ctrl K anywhere, "/" when you're not typing. */
function useHotkey() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { open, setOpen } = usePalette.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !t?.closest("input, textarea, select, [contenteditable]")) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Mounted once in the site layout: the hotkey now, the palette itself once it's wanted. */
export function CommandPalette() {
  const loaded = usePalette((s) => s.loaded);
  useHotkey();
  return loaded ? <PaletteDialog /> : null;
}
