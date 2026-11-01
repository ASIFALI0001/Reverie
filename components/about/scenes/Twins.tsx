"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { MatchMini } from "@/components/title/MatchRing";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";

/**
 * 12 · Taste Twins. Two abstract avatars (the same gradient blobs twins get) drift in from either
 * side as you scroll and, through an SVG "goo" filter, flow into each other when they meet, like
 * two drops. Then "87% taste twin" appears and the titles they both loved spill out from the join.
 * Phones: plays on arrival. Reduced motion: met, with the posters.
 */
export default function Twins({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const goo = useId().replace(/:/g, "");
  const loved = CAST.twins.map((k) => titleOf(data, k)).filter((t) => t?.posterPath);

  useGsapScene(ref, !reduced, wide ? "wide" : "narrow", ({ gsap }, root, el) => {
    const [a, b] = el.querySelectorAll<HTMLElement>("[data-blob]");
    gsap.set(el.querySelector("[data-label]"), { opacity: 0, y: 12 });
    gsap.set(el.querySelectorAll("[data-loved]"), { opacity: 0, y: -40, scale: 0.6 });
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: wide
        ? { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.7 }
        : { trigger: el, start: "top 70%", toggleActions: "play none none none" },
    });
    tl.fromTo(a!, { xPercent: -300 }, { xPercent: -88, duration: 0.55, ease: "power2.inOut" }, 0)
      .fromTo(b!, { xPercent: 200 }, { xPercent: -12, duration: 0.55, ease: "power2.inOut" }, 0)
      .to(el.querySelector("[data-label]"), { opacity: 1, y: 0, duration: 0.1 }, 0.6)
      .to(el.querySelectorAll("[data-loved]"), { opacity: 1, y: 0, scale: 1, duration: 0.18, stagger: 0.04, ease: "back.out(1.6)" }, 0.68)
      .to({}, { duration: 0.08 });
    if (!wide) tl.timeScale(0.4);
  });

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-3xl">
      <svg aria-hidden="true" className="absolute size-0">
        <filter id={goo}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
        </filter>
      </svg>
      <div aria-hidden="true" className="relative mx-auto h-[clamp(10rem,22vw,15rem)]" style={{ filter: `url(#${goo})` }}>
        <span data-blob className="absolute left-1/2 top-1/2 size-[clamp(8rem,17vw,12rem)] -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle at 30% 28%, oklch(0.82 0.11 60), oklch(0.55 0.14 30) 72%)", transform: reduced ? "translateX(-88%)" : undefined }} />
        <span data-blob className="absolute left-1/2 top-1/2 size-[clamp(8rem,17vw,12rem)] -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle at 30% 28%, oklch(0.8 0.1 220), oklch(0.5 0.13 270) 72%)", transform: reduced ? "translateX(-12%)" : undefined }} />
      </div>
      <div data-label className="mt-6 flex items-center justify-center gap-3">
        <MatchMini value={87} label="taste twin" />
        <p className="font-display text-[1.5rem] leading-none">87% taste twin</p>
      </div>
      <div className="mt-8 text-center">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">Loved by your twins</p>
        <ul className="mt-4 flex justify-center gap-3">
          {loved.map((t) => (
            <li key={t!.key} data-loved className="relative aspect-[2/3] w-[clamp(4rem,9vw,6.25rem)] overflow-hidden rounded-[2px] bg-surface shadow-[0_16px_40px_rgb(0_0_0/0.4)]">
              <Image src={tmdbImg(t!.posterPath, "thumb")!} alt={t!.title} fill sizes="100px" className="object-cover" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
