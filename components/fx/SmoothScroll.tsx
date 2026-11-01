"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

const LenisRoot = dynamic(() => import("@/components/fx/LenisRoot"), { ssr: false });

const INTENT = ["wheel", "keydown", "pointerdown"] as const;

/**
 * Smooth scrolling, started off the critical path: Lenis loads a beat after the page has,
 * or at the first wheel, key or pointer input if that comes sooner. Until then scrolling
 * is native, which is what the first moments of a page need anyway. GSAP isn't loaded
 * here: scroll-driven pieces load it on demand, and LenisRoot keeps ScrollTrigger in step.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let timer = 0;
    const start = () => setStarted(true);
    const afterLoad = () => (timer = window.setTimeout(start, 1500));
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    for (const type of INTENT) window.addEventListener(type, start, { once: true, passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", afterLoad);
      for (const type of INTENT) window.removeEventListener(type, start);
    };
  }, []);

  return (
    <>
      {children}
      {started ? <LenisRoot /> : null}
    </>
  );
}
