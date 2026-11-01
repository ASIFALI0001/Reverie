"use client";

import Image from "next/image";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { MatchBadge } from "@/components/title/MatchRing";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";

const QUERY = "something like Jurassic World but scarier";
const CHIPS = ["Like Jurassic World", "+ horror", "< 2 hours"];
const MATCHES = [94, 91, 88, 86, 83, 81, 79, 76, 74, 71];

/**
 * 05 · Ask anything. The query types itself as you scroll, the way Reverie reads it pops out as
 * chips, and ten results burst from a fanned stack into a ranked list (FLIP: each card starts
 * fanned at the centre and travels to its measured place). Phones: it plays on arrival.
 * Reduced motion: the finished search.
 */
export default function Ask({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const results = CAST.scarier.map((k) => titleOf(data, k)).filter((t) => t?.posterPath);

  useGsapScene(ref, !reduced, wide ? "wide" : "narrow", ({ gsap }, root, el) => {
    const typed = el.querySelector<HTMLElement>("[data-typed]")!;
    const chips = el.querySelectorAll("[data-chip]");
    const items = [...el.querySelectorAll<HTMLElement>("[data-result]")];
    const list = el.querySelector<HTMLElement>("[data-list]")!.getBoundingClientRect();
    const cx = list.left + list.width / 2;
    const cy = list.top + list.height * 0.3;
    const typing = { n: 0 };
    typed.textContent = "";
    gsap.set(chips, { scale: 0, opacity: 0 });
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: wide
        ? { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 }
        : { trigger: el, start: "top 70%", toggleActions: "play none none none" },
    });
    tl.to(typing, { n: QUERY.length, duration: 0.3, onUpdate: () => void (typed.textContent = QUERY.slice(0, Math.round(typing.n))) }, 0)
      .to(chips, { scale: 1, opacity: 1, duration: 0.06, stagger: 0.04, ease: "back.out(2.2)" }, 0.32)
      .from(
        items,
        {
          // From a fan at the centre to each card's real place in the list.
          x: (_i: number, it: HTMLElement) => cx - (it.getBoundingClientRect().left + it.getBoundingClientRect().width / 2),
          y: (_i: number, it: HTMLElement) => cy - (it.getBoundingClientRect().top + it.getBoundingClientRect().height / 2),
          rotate: (i: number) => (i - (items.length - 1) / 2) * 7,
          opacity: 0,
          duration: 0.3,
          stagger: 0.015,
          ease: "power3.out",
        },
        0.48,
      )
      .to({}, { duration: 0.12 });
    if (!wide) tl.timeScale(0.25);
  });

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl">
      <div className="flex items-center gap-3 rounded-full border border-hairline-strong bg-surface px-5 py-4 shadow-[0_20px_60px_rgb(0_0_0/0.3)]">
        <MagnifyingGlass size={20} weight="light" className="shrink-0 text-muted" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-[clamp(1.0625rem,2vw,1.375rem)]">
          <span data-typed>{QUERY}</span>
          <span aria-hidden="true" className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.15em] animate-pulse bg-accent" />
        </p>
      </div>
      <ul aria-label="How Reverie reads it" className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <li key={c} data-chip className="rounded-full bg-accent/15 px-3.5 py-1.5 text-[0.875rem] text-text">
            {c}
          </li>
        ))}
      </ul>
      <ol data-list aria-label="Results" className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {results.slice(0, 10).map((t, i) => (
          <li key={t!.key} data-result className="flex items-center gap-3 rounded-[6px] border border-hairline bg-surface/60 p-2 pr-3">
            <span className="w-5 text-right font-mono text-[0.75rem] text-muted">{i + 1}</span>
            <span className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-[2px] bg-raised">
              <Image src={tmdbImg(t!.posterPath, "thumb")!} alt="" fill sizes="36px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{t!.title}</span>
            <MatchBadge value={MATCHES[i]!} className="bg-text/[0.06]" />
          </li>
        ))}
      </ol>
    </div>
  );
}
