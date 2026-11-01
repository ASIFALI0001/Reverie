"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { cn } from "@/lib/cn";

// Six words on why each is like Jurassic World, closest first.
const WHY: Record<string, string> = {
  "movie:329": "The original park, the original awe",
  "movie:330": "Same island chaos, bigger teeth",
  "movie:507086": "Same heroes, dinosaurs everywhere now",
  "movie:293167": "Island expedition meets ancient giants",
  "movie:254": "Giant creature, doomed spectacle, big heart",
  "movie:124905": "Monster scale, cities in the way",
  "movie:427641": "Huge animals, playful blockbuster mayhem",
  "movie:578": "The creature you never see coming",
};
const INNER = 3;

/**
 * 07 · More like this. Jurassic World in the middle; the titles most like it on the inner orbit,
 * the rest further out, each tied to it by a thin line. Scrolling turns the orbits (in opposite
 * directions, posters staying upright) while the reading moves out from the closest: each title
 * takes its turn in the reading below with six words on why. Phones and reduced motion: the orbits
 * hold still and every reason is listed.
 */
export default function Similar({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const [active, setActive] = useState(0);
  const source = titleOf(data, CAST.source);
  const near = CAST.similar.map((k) => titleOf(data, k)).filter((t) => t?.posterPath);
  const rings = [near.slice(0, INNER), near.slice(INNER)];
  const playing = wide && !reduced;

  useGsapScene(ref, playing && near.length > 0, "wide", ({ gsap }, root, el) => {
    const ringEls = [...el.querySelectorAll<HTMLElement>("[data-ring]")];
    const turns = [80, -50];
    const spin = { p: 0 };
    gsap.to(spin, {
      p: 1,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.8 },
      onUpdate: () => {
        ringEls.forEach((ring, r) => {
          const deg = turns[r]! * spin.p;
          gsap.set(ring, { rotate: deg });
          gsap.set(ring.querySelectorAll("[data-upright]"), { rotate: -deg });
        });
        const i = Math.min(near.length - 1, Math.floor(spin.p * near.length * 0.999));
        setActive((a) => (a === i ? a : i));
      },
    });
  });

  const current = near[active];
  return (
    <div ref={ref} className="flex w-full flex-col items-center gap-6">
      {/* Sized by its column and, while the stage holds, by the screen's height (the reading sits below). */}
      <div className="relative aspect-square w-full max-w-[34rem] [container-type:inline-size] lg:max-w-[min(34rem,calc(100svh_-_2*var(--nav-h)_-_12rem))]">
        {rings.map((ring, r) => {
          const radius = r === 0 ? 26 : 44;
          return (
            <div key={r} data-ring className="absolute inset-0">
              <span aria-hidden="true" className="absolute rounded-full border border-hairline" style={{ inset: `${50 - radius}%` }} />
              {ring.map((t, i) => {
                const a = (i / ring.length) * Math.PI * 2 + (r ? 0.4 : -0.6);
                const x = 50 + Math.cos(a) * radius;
                const y = 50 + Math.sin(a) * radius;
                const lit = playing && t!.key === current?.key;
                return (
                  <div key={t!.key}>
                    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
                      <line x1="50" y1="50" x2={x} y2={y} stroke={lit ? "var(--color-accent)" : "var(--color-hairline-strong)"} strokeWidth={lit ? 0.35 : 0.15} />
                    </svg>
                    <div className={cn("absolute -translate-x-1/2 -translate-y-1/2", r === 0 ? "w-[14cqw]" : "w-[11.75cqw]")} style={{ left: `${x}%`, top: `${y}%` }}>
                      <div data-upright>
                        <div
                          className={cn(
                            "relative aspect-[2/3] overflow-hidden rounded-[2px] bg-surface shadow-[0_12px_30px_rgb(0_0_0/0.4)] transition-[opacity,box-shadow] duration-500",
                            playing && !lit && "opacity-55",
                            lit && "shadow-[0_0_0_2px_var(--color-accent),0_12px_30px_rgb(0_0_0/0.4)]",
                          )}
                        >
                          <Image src={tmdbImg(t!.posterPath, "thumb")!} alt="" fill sizes="76px" className="object-cover" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {source?.posterPath ? (
          <div className="absolute left-1/2 top-1/2 w-[22cqw] -translate-x-1/2 -translate-y-1/2">
            <div className="relative aspect-[2/3] overflow-hidden rounded-[2px] shadow-[0_24px_60px_rgb(0_0_0/0.55)]">
              <Image src={tmdbImg(source.posterPath)!} alt={source.title} fill sizes="7.5rem" className="object-cover" />
            </div>
          </div>
        ) : null}
      </div>

      {/* The reading: one title at a time, closest first (wide screens with motion). */}
      {playing && current ? (
        <div aria-hidden="true" className="min-h-[6.5rem] text-center">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">
            {active + 1} of {near.length} · {active < INNER ? "closest" : "further out"}
          </p>
          <p className="mt-2 font-display text-[1.75rem] leading-tight">{current.title}</p>
          <p className="mt-1 text-[1.0625rem] leading-snug text-muted">{WHY[current.key]}</p>
        </div>
      ) : null}
      <ol className={cn("mx-auto w-full max-w-md space-y-2", playing && "sr-only")}>
        {near.map((t) => (
          <li key={t!.key} className="flex flex-col gap-0.5 border-b border-hairline pb-2 text-[0.9375rem] sm:flex-row sm:justify-between sm:gap-4">
            <span>{t!.title}</span>
            <span className="text-muted sm:text-right">{WHY[t!.key]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
