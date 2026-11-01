"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Renders its children from the first scroll on: for below-the-fold, initially invisible pieces. */
export function OnFirstScroll({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (on) return;
    const arm = () => setOn(true);
    window.addEventListener("scroll", arm, { once: true, passive: true });
    return () => window.removeEventListener("scroll", arm);
  }, [on]);
  return on ? children : null;
}
