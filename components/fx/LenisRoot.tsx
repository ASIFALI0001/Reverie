"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ReactLenis, useLenis } from "lenis/react";
import { useReducedMotion } from "motion/react";
import { gsapIfLoaded } from "@/lib/fx/gsap";

/**
 * Lenis on the root scroller. With prefers-reduced-motion, wheel smoothing is off and
 * scrolling is native. Client-only (SmoothScroll mounts it after load), so there's no
 * server render to match.
 */
export default function LenisRoot() {
  const reduced = useReducedMotion();
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        smoothWheel: !reduced,
        anchors: true,
        // Nested scrollers (rails, dialogs, palettes) opt out with data-lenis-prevent.
        prevent: (node) => node.closest?.("[data-lenis-prevent]") != null,
      }}
    >
      <ScrollBridge />
    </ReactLenis>
  );
}

/**
 * Keeps ScrollTrigger (when loaded) in step with Lenis. On route change, Next has already
 * scrolled (top for a push, restored offset for back/forward) by the time this effect
 * runs, so Lenis adopts that position instead of easing toward a stale target.
 */
function ScrollBridge() {
  const pathname = usePathname();
  const lenis = useLenis(() => gsapIfLoaded()?.ScrollTrigger.update());

  useEffect(() => {
    lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
    gsapIfLoaded()?.ScrollTrigger.refresh();
  }, [pathname, lenis]);

  return null;
}
