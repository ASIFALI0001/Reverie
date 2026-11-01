"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { loadGsap } from "@/lib/fx/gsap";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import type { SceneProps } from "@/components/about/types";

const COLS = 7;
const ROWS = 5;

/**
 * 00 · Opening. Behind the title, a wall of real posters drifts in three depth layers. On wide
 * screens, scrolling tilts the wall back in 3D and the posters fly apart, opening a way "in"
 * (one scrubbed, pinned timeline). Phones: the wall just eases up and fades. Reduced motion: still.
 */
export default function Opening({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const posters = (data?.wall ?? []).slice(0, COLS * ROWS);

  useEffect(() => {
    const el = ref.current;
    const root = el?.closest<HTMLElement>("[data-chapter]");
    if (!el || !root || reduced || !posters.length) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        const wall = el.querySelector("[data-wall]");
        const words = root.querySelectorAll("[data-words]");
        if (!wide) {
          gsap.to(wall, { yPercent: -10, opacity: 0.25, ease: "none", scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true } });
          return;
        }
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.8 },
        });
        tl.to(wall, { rotateX: 54, scale: 0.8, yPercent: -6, duration: 1 }, 0)
          .to(
            el.querySelectorAll<HTMLElement>("[data-poster]"),
            {
              x: (_i: number, p: HTMLElement) => Number(p.dataset.dx) * window.innerWidth * 0.42,
              y: (_i: number, p: HTMLElement) => Number(p.dataset.dy) * window.innerHeight * 0.36,
              z: (_i: number, p: HTMLElement) => 240 + Number(p.dataset.layer) * 220,
              opacity: 0,
              duration: 0.8,
              ease: "power2.in",
            },
            0.2,
          )
          .to(words, { opacity: 0, y: -36, duration: 0.45, stagger: 0.05 }, 0.3);
      }, root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [reduced, wide, posters.length]);

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 overflow-hidden [perspective:1100px]">
      <div data-wall className="absolute inset-[-8%] grid origin-[50%_35%] grid-cols-7 gap-[clamp(0.5rem,1.4vw,1.25rem)] [transform-style:preserve-3d]">
        {posters.map((p, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const layer = (col * 7 + row * 3) % 3;
          return (
            <div
              key={p.key}
              data-poster
              data-layer={layer}
              data-dx={(col - (COLS - 1) / 2) / ((COLS - 1) / 2)}
              data-dy={(row - (ROWS - 1) / 2) / ((ROWS - 1) / 2)}
              className={layer === 0 ? "opacity-40" : layer === 1 ? "opacity-60" : "opacity-80"}
              style={{ transform: `translateZ(${layer * 60}px)` }}
            >
              <div className={reduced ? "" : "drift"} data-dir={col % 2 ? "down" : undefined} style={{ ["--drift-dur" as string]: `${90 + layer * 30}s` }}>
                <div className="relative aspect-[2/3] overflow-hidden rounded-[2px] bg-surface">
                  <Image src={tmdbImg(p.posterPath)!} alt="" fill sizes="(min-width: 1024px) 12vw, 22vw" className="object-cover" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Keep the words legible: the wall darkens toward the middle and the edges. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, color-mix(in oklab, var(--color-bg) 92%, transparent) 0%, color-mix(in oklab, var(--color-bg) 60%, transparent) 45%, transparent 80%)",
        }}
      />
      <div className="absolute inset-0 bg-linear-to-b from-bg/70 via-transparent to-bg" />
      {/* The chapter rail sits over this edge: keep it readable. */}
      <div className="absolute inset-y-0 left-0 hidden w-48 bg-linear-to-r from-bg/90 to-transparent lg:block" />
    </div>
  );
}
