"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { loadGsap } from "@/lib/fx/gsap";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { cn } from "@/lib/cn";

const ROWS = 4;
const PER_ROW = 12;

/**
 * 01 · The problem. Rows of posters stream past in opposite directions, faster and faster as you
 * scroll (the row speed accelerates with an ease-in curve), until everything stops, the rows
 * fade, and one poster is left in the middle, glowing. Phones: the rows drift on their own and
 * the poster rises in. Reduced motion: a still composition.
 */
export default function Problem({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const wall = data?.wall ?? [];
  const hero = titleOf(data, CAST.match);
  const rows = Array.from({ length: ROWS }, (_, r) => Array.from({ length: PER_ROW * 2 }, (_, i) => wall[(r * 7 + i * 3) % Math.max(1, wall.length)]).filter(Boolean));

  useEffect(() => {
    const el = ref.current;
    const root = el?.closest<HTMLElement>("[data-chapter]");
    if (!el || !root || reduced || !wide || !wall.length) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        const rowEls = el.querySelectorAll<HTMLElement>("[data-row]");
        const one = root.querySelector('[data-line="1"]');
        const two = root.querySelector('[data-line="2"]');
        gsap.set(two, { opacity: 0, y: 24 });
        gsap.set(el.querySelector("[data-hero]"), { opacity: 0, scale: 0.7 });
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
        // Faster and faster: an ease-in on distance is speed rising with every scroll step.
        rowEls.forEach((row, i) => {
          const dir = i % 2 ? 1 : -1;
          tl.fromTo(row, { xPercent: dir > 0 ? -50 : 0 }, { xPercent: dir > 0 ? 0 : -50, duration: 0.7, ease: "power3.in" }, 0);
        });
        tl.to(one, { opacity: 0, y: -24, duration: 0.12 }, 0.58)
          .to(rowEls, { opacity: 0.06, filter: "blur(6px)", duration: 0.15 }, 0.7)
          .to(el.querySelector("[data-hero]"), { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" }, 0.74)
          .to(two, { opacity: 1, y: 0, duration: 0.14 }, 0.84)
          .to({}, { duration: 0.1 });
      }, root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [reduced, wide, wall.length]);

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 -rotate-3 flex-col gap-[clamp(0.5rem,1.2vw,1rem)]">
        {rows.map((row, r) => (
          <div key={r} className="overflow-visible">
            <div data-row className={cn("flex w-max gap-[clamp(0.5rem,1.2vw,1rem)]", !wide && !reduced && "drift-x")} style={{ ["--drift-dur" as string]: `${60 + r * 12}s` }}>
              {row.map((p, i) => (
                <div key={`${p!.key}-${i}`} className="relative aspect-[2/3] w-[clamp(4.5rem,9vw,8.5rem)] shrink-0 overflow-hidden rounded-[2px] bg-surface opacity-70">
                  <Image src={tmdbImg(p!.posterPath)!} alt="" fill sizes="(min-width: 1024px) 9vw, 18vw" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-bg/55" />
      {/* Quiet behind the two lines (top left, bottom right) and under the chapter rail. */}
      <div className="absolute inset-x-0 top-0 h-[45%] bg-linear-to-b from-bg/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[35%] bg-linear-to-t from-bg/90 to-transparent" />
      <div className="absolute inset-y-0 left-0 hidden w-48 bg-linear-to-r from-bg/90 to-transparent lg:block" />
      {hero?.posterPath ? (
        <div data-hero className={cn("absolute left-1/2 top-1/2 w-[clamp(9rem,17vw,15rem)] -translate-x-1/2 -translate-y-1/2", !wide && !reduced && "opacity-90")}>
          <div className="absolute -inset-[35%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_45%,transparent),transparent_65%)] blur-2xl" />
          <div className="relative aspect-[2/3] overflow-hidden rounded-[2px] shadow-[0_30px_80px_rgb(0_0_0/0.6)]">
            <Image src={tmdbImg(hero.posterPath)!} alt="" fill sizes="(min-width: 1024px) 17vw, 40vw" className="object-cover" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
