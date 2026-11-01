"use client";

import { useEffect, useRef, useState } from "react";
import { loadGsap, type GsapKit } from "@/lib/fx/gsap";

/**
 * Drives the landing's scroll story. The scene itself is server-rendered markup (no
 * hydration cost); this only finds it and attaches one scrubbed, pinned timeline.
 * With reduced motion it does nothing and CSS shows the still version instead.
 */
export function StoryMotion() {
  const anchor = useRef<HTMLSpanElement>(null);

  // The wall's posters load when the story is approached, not with the page: on the first
  // scroll, when the scene nears the viewport, or a beat after load, whichever comes first.
  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>("[data-story]");
    if (!root) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      cleanup();
      for (const img of root.querySelectorAll<HTMLImageElement>("img[data-src]")) {
        const show = () => (img.style.opacity = img.dataset.opacity ?? "1");
        img.addEventListener("load", show, { once: true });
        img.src = img.dataset.src!;
        img.removeAttribute("data-src");
        if (img.complete) show();
      }
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && reveal(), { rootMargin: "0px 0px 35% 0px" });
    io.observe(root);
    window.addEventListener("scroll", reveal, { once: true, passive: true });
    let timer = 0;
    const afterLoad = () => (timer = window.setTimeout(reveal, 1200));
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    function cleanup() {
      io.disconnect();
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("load", afterLoad);
      clearTimeout(timer);
    }
    return cleanup;
  }, []);

  // Building the pinned scene measures layout; do it on the first scroll (clear intent, and
  // long before the scene, a full screen down, can be reached) rather than at load.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed) return;
    const arm = () => setArmed(true);
    window.addEventListener("scroll", arm, { once: true, passive: true });
    return () => window.removeEventListener("scroll", arm);
  }, [armed]);

  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>("[data-story]");
    if (!armed || !root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => build(gsap, root), root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [armed]);

  return <span ref={anchor} hidden />;
}

/** The scrubbed, pinned timeline: four beats over 320% of the viewport. */
function build(gsap: GsapKit["gsap"], root: HTMLElement) {
  const q = gsap.utils.selector(root);
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: root,
      start: "top top",
      end: "+=320%",
      scrub: 0.8,
      pin: q("[data-stage]")[0],
      anticipatePin: 1,
    },
  });

  // 1 → 2: the wall tilts back and its layers come apart.
  tl.to(q("[data-wall]"), { rotateX: 34, rotateZ: -7, scale: 0.78, yPercent: -6, duration: 1 }, 0)
    .to(q('[data-layer="1"]'), { z: 170, duration: 1 }, 0)
    .to(q('[data-layer="2"]'), { z: 340, duration: 1 }, 0)
    .to(q('[data-beat="0"]'), { autoAlpha: 0, y: -24, duration: 0.25 }, 0.12)
    .fromTo(q('[data-beat="1"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.4)
    // 2 → 3: warm for you, cool for not.
    .to(q("[data-warm]"), { autoAlpha: 1, duration: 0.6 }, 1.25)
    .to(q("[data-cool]"), { autoAlpha: 1, duration: 0.6 }, 1.25)
    .to(q('[data-tone="warm"]'), { z: "+=90", duration: 0.6 }, 1.25)
    .to(q('[data-beat="1"]'), { autoAlpha: 0, y: -24, duration: 0.25 }, 1.25)
    .fromTo(q('[data-beat="2"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 1.5)
    // 3 → 4: one poster forward, with its match.
    .to(q("[data-wall]"), { autoAlpha: 0.18, scale: 0.7, duration: 0.7 }, 2.25)
    .fromTo(q("[data-feature]"), { autoAlpha: 0, scale: 0.55, z: -400, rotateY: -18 }, { autoAlpha: 1, scale: 1, z: 0, rotateY: 0, duration: 0.7 }, 2.3)
    .fromTo(q("[data-feature-ring]"), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.4 }, 2.65)
    .to(q('[data-beat="2"]'), { autoAlpha: 0, y: -24, duration: 0.25 }, 2.3)
    .fromTo(q('[data-beat="3"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 2.55)
    .to({}, { duration: 0.35 });
}
