"use client";

type Gsap = typeof import("gsap").default;
type ScrollTriggerT = typeof import("gsap/ScrollTrigger").ScrollTrigger;
type SplitTextT = typeof import("gsap/SplitText").SplitText;
export type GsapKit = { gsap: Gsap; ScrollTrigger: ScrollTriggerT; SplitText: SplitTextT };

let task: Promise<GsapKit> | null = null;
let kit: GsapKit | null = null;

/**
 * GSAP (+ ScrollTrigger, SplitText) on demand. Nothing on a page's first screen needs it,
 * so it loads when the first scroll-driven piece is approached and is shared from then on.
 */
export function loadGsap(): Promise<GsapKit> {
  task ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("gsap/SplitText")]).then(([g, st, sp]) => {
    const gsap = g.default;
    gsap.registerPlugin(st.ScrollTrigger, sp.SplitText);
    kit = { gsap, ScrollTrigger: st.ScrollTrigger, SplitText: sp.SplitText };
    refreshOnReflow(st.ScrollTrigger);
    return kit;
  });
  return task;
}

/**
 * Trigger positions are measured once, so they go stale when the page's height changes
 * after they're made: deferred sections rendering at their real size, data arriving,
 * rails filling. ScrollTrigger only re-measures on window resize; re-measure on reflow too.
 */
function refreshOnReflow(ScrollTrigger: ScrollTriggerT) {
  let height = document.body.scrollHeight;
  let timer = 0;
  new ResizeObserver(() => {
    if (document.body.scrollHeight === height) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      height = document.body.scrollHeight;
      ScrollTrigger.refresh();
    }, 200);
  }).observe(document.body);
}

/** The kit if it has already loaded (for sync work like refreshing triggers after navigation). */
export function gsapIfLoaded(): GsapKit | null {
  return kit;
}
