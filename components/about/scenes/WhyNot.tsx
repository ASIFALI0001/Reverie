"use client";

import Image from "next/image";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { MatchMini } from "@/components/title/MatchRing";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";

/**
 * 04 · Why not? The 41% card from the chapter before turns over (a 3D flip scrubbed by scroll)
 * and its reasons type themselves out letter by letter, each with the posters it rests on
 * sliding in beside it. Phones: the flip and typing play on arrival. Reduced motion: the back
 * of the card, as it reads.
 */
export default function WhyNot({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const low = titleOf(data, CAST.low);
  const [pride, laLand] = CAST.evidence.map((k) => titleOf(data, k));
  const reasons = [
    { text: `You rated romantic dramas like ${pride?.title ?? "Pride & Prejudice"} low`, evidence: pride },
    { text: `You stopped ${laLand?.title ?? "La La Land"} partway through`, evidence: laLand },
    { text: "Slower than the films you usually finish", evidence: null },
  ];

  useGsapScene(ref, !reduced, wide ? "wide" : "narrow", ({ gsap, SplitText }, root, el) => {
    const card = el.querySelector("[data-flip]");
    const lines = [...el.querySelectorAll<HTMLElement>("[data-reason]")];
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: wide
        ? { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 }
        : { trigger: el, start: "top 70%", toggleActions: "play none none none" },
    });
    tl.fromTo(card, { rotateY: 0 }, { rotateY: 180, duration: 0.3, ease: "power2.inOut" }, 0.05);
    lines.forEach((line, i) => {
      const split = new SplitText(line.querySelector("[data-type]")!, { type: "words,chars", aria: "none" });
      const t = 0.4 + i * 0.17;
      tl.from(split.chars, { opacity: 0, duration: 0.004, stagger: 0.0035 }, t).from(line.querySelectorAll("[data-ev]"), { x: 24, opacity: 0, duration: 0.06, stagger: 0.02, ease: "power2.out" }, t + 0.06);
    });
    tl.to({}, { duration: 0.08 });
    if (!wide) tl.timeScale(0.32);
  });

  return (
    <div ref={ref} className="mx-auto w-[min(88vw,25rem)] [perspective:1400px]">
      <div data-flip className="relative aspect-[4/5] [transform-style:preserve-3d]" style={reduced ? { transform: "rotateY(180deg)" } : undefined}>
        {/* Front: the 41% card. */}
        <div className="absolute inset-0 overflow-hidden rounded-[6px] border border-hairline bg-surface [backface-visibility:hidden]">
          {low?.posterPath ? <Image src={tmdbImg(low.posterPath)!} alt="" fill sizes="25rem" className="object-cover opacity-80" /> : null}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-linear-to-t from-bg/95 via-bg/60 to-transparent p-5 pt-16">
            <p className="font-display text-[1.75rem] leading-none">{low?.title ?? "The Notebook"}</p>
            <MatchMini value={41} />
          </div>
        </div>
        {/* Back: why it might not be for you. */}
        <div className="absolute inset-0 rounded-[6px] border border-hairline-strong bg-raised p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="caption text-muted">Why it might not be for you</p>
          <ul className="mt-5 space-y-5">
            {reasons.map((r) => (
              <li key={r.text} data-reason className="border-b border-hairline pb-4">
                <p className="text-[1.0625rem] leading-snug">
                  {/* Screen readers get the sentence whole; the copy that types itself is hidden from them. */}
                  <span className="sr-only">{r.text}</span>
                  <span data-type aria-hidden="true">
                    {r.text}
                  </span>
                </p>
                {r.evidence?.posterPath ? (
                  <div data-ev className="mt-2.5 flex items-center gap-2">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">Based on</span>
                    <span className="relative block aspect-[2/3] w-8 overflow-hidden rounded-[2px] bg-surface">
                      <Image src={tmdbImg(r.evidence.posterPath, "thumb")!} alt={r.evidence.title} fill sizes="32px" className="object-cover" />
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
