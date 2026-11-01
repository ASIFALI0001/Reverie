"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { MatchDialFace } from "@/components/title/MatchRing";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { ease } from "@/lib/motion";

const HIGH = 92;
const LOW = 41;
// What goes into the number, in a row under the dial.
const PARTS = ["Your history", "Titles like it you loved", "Pace, tone, depth", "A careful AI read"];

/**
 * 03 · Match. The real match dial, scrubbed by scroll: Interstellar slides in and the ring draws
 * to 92 (counting, warming); then a mask wipes to The Notebook and the ring falls to 41, cooling.
 * Thin connector lines draw out to what goes into the number. Phones: the same beats play on
 * their own when the chapter arrives. Reduced motion: both readings, still.
 */
export default function Match({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const progress = useMotionValue(reduced ? HIGH : 0);
  const high = titleOf(data, CAST.match);
  const low = titleOf(data, CAST.low);

  useGsapScene(ref, wide && !reduced, "wide", ({ gsap }, root, el) => {
    const dial = { v: 0 };
    const set = () => progress.set(dial.v);
    gsap.set(el.querySelector("[data-second]"), { clipPath: "inset(0 0 0 100%)" });
    gsap.set(el.querySelectorAll("[data-line]"), { strokeDashoffset: 1 });
    gsap.set(el.querySelectorAll("[data-part]"), { opacity: 0 });
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.7 },
    });
    tl.fromTo(el.querySelector("[data-posters]"), { xPercent: -30, opacity: 0, rotate: -3 }, { xPercent: 0, opacity: 1, rotate: 0, duration: 0.18, ease: "power2.out" }, 0)
      .to(dial, { v: HIGH, duration: 0.3, onUpdate: set, ease: "power1.inOut" }, 0.1)
      .to(el.querySelectorAll("[data-line]"), { strokeDashoffset: 0, duration: 0.12, stagger: 0.03 }, 0.28)
      .to(el.querySelectorAll("[data-part]"), { opacity: 1, duration: 0.08, stagger: 0.03 }, 0.32)
      .to(el.querySelector("[data-second]"), { clipPath: "inset(0 0 0 0%)", duration: 0.16, ease: "power2.inOut" }, 0.58)
      .to(dial, { v: LOW, duration: 0.22, onUpdate: set, ease: "power1.inOut" }, 0.6)
      .to(el.querySelector("[data-name-a]"), { opacity: 0, duration: 0.06 }, 0.6)
      .to(el.querySelector("[data-name-b]"), { opacity: 1, duration: 0.06 }, 0.68)
      .to({}, { duration: 0.12 });
  });

  // Phones: the two beats play by themselves once the chapter is in view.
  useEffect(() => {
    if (wide || reduced) return;
    const el = ref.current;
    if (!el) return;
    let stops: { stop: () => void }[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const second = el.querySelector<HTMLElement>("[data-second]");
        stops = [
          animate(progress, HIGH, { duration: 1.6, ease: ease.out }),
          animate(progress, LOW, { duration: 1.2, ease: ease.out, delay: 3 }),
          ...(second ? [animate(second, { clipPath: ["inset(0 0 0 100%)", "inset(0 0 0 0%)"] }, { duration: 0.7, delay: 2.8, ease: ease.out })] : []),
        ];
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stops.forEach((s) => s.stop());
    };
  }, [wide, reduced, progress]);

  return (
    <div ref={ref} className="relative mx-auto grid w-full max-w-4xl items-center gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
      <div data-posters className="relative mx-auto aspect-[2/3] w-[min(62vw,17rem)]">
        {[high, low].map((t, i) =>
          t?.posterPath ? (
            <div key={t.key} data-second={i === 1 ? "" : undefined} className="absolute inset-0 overflow-hidden rounded-[2px] shadow-[0_30px_70px_rgb(0_0_0/0.45)]" style={i === 1 ? { clipPath: reduced ? "inset(0 0 0 100%)" : undefined } : undefined}>
              <Image src={tmdbImg(t.posterPath)!} alt="" fill sizes="(min-width: 1024px) 17rem, 62vw" placeholder={t.posterBlur ? "blur" : "empty"} blurDataURL={t.posterBlur ?? undefined} className="object-cover" />
            </div>
          ) : null,
        )}
        <p className="absolute -bottom-9 left-0 font-display text-[1.375rem]">
          <span data-name-a>{high?.title ?? "Interstellar"}</span>
          <span data-name-b className="absolute left-0 top-0 whitespace-nowrap opacity-0">
            {low?.title ?? "The Notebook"}
          </span>
        </p>
      </div>
      <div className="relative mx-auto flex w-full max-w-[30rem] flex-col items-center">
        <div className="relative aspect-square w-[min(70vw,19rem)] [container-type:inline-size]">
          <MatchDialFace progress={progress} label="your match" />
        </div>
        {/* What goes into the number: four thin lines fan out from the dial to it (wide screens). */}
        <svg aria-hidden="true" viewBox="0 0 400 56" preserveAspectRatio="none" className="hidden h-14 w-full lg:block">
          {PARTS.map((p, i) => (
            <path key={p} data-line d={`M200,0 C200,30 ${50 + i * 100},24 ${50 + i * 100},56`} pathLength={1} strokeDasharray="1" fill="none" stroke="var(--color-hairline-strong)" strokeWidth="1" />
          ))}
        </svg>
        <ul aria-label="What goes into the number" className="hidden w-full grid-cols-4 gap-2 lg:grid">
          {PARTS.map((p) => (
            <li key={p} data-part className="text-center font-mono text-[0.625rem] uppercase leading-snug tracking-[0.12em] text-muted">
              {p}
            </li>
          ))}
        </ul>
        {reduced ? <p className="mt-4 text-center text-meta text-muted">{`${high?.title ?? "Interstellar"} ${HIGH}% · ${low?.title ?? "The Notebook"} ${LOW}%`}</p> : null}
      </div>
    </div>
  );
}
