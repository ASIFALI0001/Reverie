"use client";

import Image from "next/image";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { cn } from "@/lib/cn";

// The deck's verdicts, top card first, and the genre chips each one lights.
const VERDICTS: ("loved" | "nope")[] = ["loved", "nope", "loved", "loved", "nope"];
const CHIPS = ["Sci-fi", "Slow burn", "Dark comedy", "Thriller", "Heartfelt", "Mind-bending", "Big spectacle", "Quiet drama"];
const LIGHTS = [[0, 5], [], [2, 7], [3], []];
const DNA = ["Drawn to big, quiet sci-fi", "Likes a comedy with teeth", "Patient with a slow burn"];

/**
 * 02 · Your taste, learned. A live mini swipe deck, scrubbed by scroll: each card tips left or
 * right with its LOVED or NOPE stamp, and the genre chips it says something about light up.
 * Then the deck draws in to a glow and the Taste DNA phrases rise out of it. Phones: the deck
 * plays through on its own. Reduced motion: the outcome, still.
 */
export default function Taste({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const cards = CAST.deck.map((k) => titleOf(data, k)).filter((t) => t?.posterPath);

  useGsapScene(ref, !reduced, wide ? "wide" : "narrow", ({ gsap }, root, el) => {
    const cardEls = [...el.querySelectorAll<HTMLElement>("[data-card]")];
    const chips = [...el.querySelectorAll<HTMLElement>("[data-chip]")];
    const dna = el.querySelectorAll("[data-dna]");
    gsap.set(dna, { opacity: 0, y: 18 });
    gsap.set(el.querySelector("[data-glow]"), { opacity: 0, scale: 0.4 });
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: wide
        ? { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 }
        : { trigger: el, start: "top 70%", toggleActions: "play none none none" },
    });
    // The top card is the last in the DOM: swipe from the top down.
    [...cardEls].reverse().forEach((card, i) => {
      const verdict = VERDICTS[i] ?? "nope";
      const dir = verdict === "loved" ? 1 : -1;
      const t = i * 0.13;
      tl.to(card.querySelector(`[data-stamp="${verdict}"]`), { opacity: 1, scale: 1, duration: 0.04 }, t)
        .to(card, { x: dir * 420, rotate: dir * 18, opacity: 0, duration: 0.09, ease: "power2.in" }, t + 0.05);
      for (const c of LIGHTS[i] ?? []) tl.to(chips[c]!, { color: "var(--color-text)", borderColor: "var(--color-accent)", backgroundColor: "color-mix(in oklab, var(--color-accent) 14%, transparent)", duration: 0.04 }, t + 0.07);
    });
    tl.to(el.querySelector("[data-glow]"), { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" }, 0.7)
      .to(dna, { opacity: 1, y: 0, duration: 0.08, stagger: 0.05 }, 0.78)
      .to({}, { duration: 0.1 });
    if (!wide) tl.timeScale(0.18);
  });

  return (
    <div ref={ref} className="grid w-full items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-[2/3] w-[min(60vw,15rem)]">
        <div data-glow aria-hidden="true" className="absolute -inset-[30%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_40%,transparent),transparent_65%)] blur-xl" style={reduced ? { opacity: 1 } : undefined} />
        {reduced ? null : (
          <div aria-hidden="true">
            {cards.map((t, i) => (
              <div key={t!.key} data-card className="absolute inset-0 overflow-hidden rounded-[6px] border border-hairline bg-surface shadow-[0_20px_50px_rgb(0_0_0/0.4)]" style={{ transform: `translateY(${(cards.length - 1 - i) * -6}px) scale(${1 - (cards.length - 1 - i) * 0.03})` }}>
                <Image src={tmdbImg(t!.posterPath)!} alt="" fill sizes="15rem" className="object-cover" />
                <span data-stamp="loved" className="absolute left-4 top-5 -rotate-12 scale-125 rounded-[4px] border-2 border-accent px-2.5 py-1 font-mono text-[0.875rem] uppercase tracking-[0.18em] text-accent opacity-0">
                  Loved
                </span>
                <span data-stamp="nope" className="absolute right-4 top-5 rotate-12 scale-125 rounded-[4px] border-2 border-text/70 px-2.5 py-1 font-mono text-[0.875rem] uppercase tracking-[0.18em] text-text/80 opacity-0">
                  Nope
                </span>
              </div>
            ))}
          </div>
        )}
        <ul aria-label="Your Taste DNA" className="absolute inset-0 flex flex-col justify-center gap-3 text-center">
          {DNA.map((p) => (
            <li key={p} data-dna className="font-display text-[clamp(1.375rem,2.4vw,1.875rem)] leading-tight">
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">What each swipe tells it</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CHIPS.map((c, i) => (
            <li key={c} data-chip className={cn("rounded-full border border-hairline-strong px-3.5 py-1.5 text-[0.875rem] text-muted", reduced && LIGHTS.flat().includes(i) && "border-accent text-text")}>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
