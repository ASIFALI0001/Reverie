"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useTheme } from "@/components/layout/ThemeToggle";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { cn } from "@/lib/cn";

// The moods the story deals for, with the same colour washes as the real mood tiles.
const MOODS = [
  { id: "light-fun", label: "Light & fun", wash: ["232 162 58", "224 115 92"] },
  { id: "cant-sleep", label: "Can’t sleep", wash: ["43 74 122", "28 40 64"] },
  { id: "good-cry", label: "Need a good cry", wash: ["109 138 168", "90 100 112"] },
  { id: "scare-me", label: "Scare me", wash: ["143 29 29", "20 8 8"] },
] as const;
const OTHERS = ["Edge of my seat", "Make me think", "Comfort rewatch", "Feel inspired", "Romantic"];
const FAN = [-1, 0, 1];
// How strongly each wash shows: a glow in the screening room, a tint at the matinée (the same
// washes at full strength turn a light page grey).
const GLOW = { dark: [0.42, 0.3], light: [0.2, 0.14] } as const;

/**
 * 06 · Mood search. The section's light changes with each mood (a scrubbed colour, the same washes
 * as the real mood tiles), the mood's tile lights up, and three picks are dealt onto the table
 * like cards, then swept off for the next mood. Phones: the moods take turns on their own.
 * Reduced motion: one mood and its three, still.
 */
export default function Mood({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const theme = useTheme();
  const glow = GLOW[theme];
  const picks = (id: string) => (CAST.moods[id as keyof typeof CAST.moods] ?? []).map((k) => titleOf(data, k)).filter((t) => t?.posterPath);

  useGsapScene(ref, wide && !reduced, `wide-${theme}`, ({ gsap }, root, el) => {
    const stage = root.querySelector<HTMLElement>("[data-stage]")!;
    // GSAP blends concrete colours only (not var()), so take the theme's from the page itself.
    const tile = getComputedStyle(el.querySelector("[data-tile]")!);
    const [ink, muted, hairline] = [getComputedStyle(root).color, tile.color, tile.borderTopColor];
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 },
    });
    MOODS.forEach((m, i) => {
      const t = i;
      const hand = el.querySelectorAll(`[data-hand="${m.id}"] [data-deal]`);
      tl.to(stage, { "--mood-a": `rgb(${m.wash[0]} / ${glow[0]})`, "--mood-b": `rgb(${m.wash[1]} / ${glow[1]})`, duration: 0.3 }, t)
        .to(el.querySelector(`[data-tile="${m.id}"]`), { color: ink, borderColor: `rgb(${m.wash[0]})`, scale: 1.06, duration: 0.15 }, t)
        .fromTo(hand, { y: 260, x: 0, rotate: -12, opacity: 0 }, { y: 0, x: (k: number) => FAN[k]! * 150, rotate: (k: number) => FAN[k]! * 6, opacity: 1, duration: 0.35, stagger: 0.08, ease: "power3.out" }, t + 0.15);
      if (i < MOODS.length - 1) {
        tl.to(hand, { x: (k: number) => FAN[k]! * 150 + 520, rotate: 14, opacity: 0, duration: 0.25, stagger: 0.04, ease: "power2.in" }, t + 0.8).to(
          el.querySelector(`[data-tile="${m.id}"]`),
          { color: muted, borderColor: hairline, scale: 1, duration: 0.15 },
          t + 0.85,
        );
      }
    });
    tl.to({}, { duration: 0.3 });
  });

  if (!wide || reduced) return <MoodSimple picks={picks} still={!!reduced} glow={glow} />;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-4xl">
      <ul aria-label="Moods" className="flex flex-wrap justify-center gap-2.5">
        {[...MOODS.map((m) => m.label), ...OTHERS].map((label, i) => {
          const m = MOODS.find((x) => x.label === label);
          return (
            <li
              key={label}
              data-tile={m?.id}
              className="rounded-full border border-hairline-strong px-4 py-2 text-[0.9375rem] text-muted"
              style={{ transform: `translateY(${(i % 3) * 6 - 6}px)` }}
            >
              {label}
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="relative mt-14 h-[clamp(14rem,24vw,19rem)]">
        {MOODS.map((m) => (
          <div key={m.id} data-hand={m.id} className="absolute inset-0 flex items-center justify-center">
            {picks(m.id).map((t) => (
              <div key={t!.key} data-deal className="absolute aspect-[2/3] w-[clamp(8rem,12vw,10.5rem)] overflow-hidden rounded-[4px] opacity-0 shadow-[0_24px_60px_rgb(0_0_0/0.5)]">
                <Image src={tmdbImg(t!.posterPath)!} alt="" fill sizes="11rem" className="object-cover" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Phones and reduced motion: the moods take turns (or one, still). */
function MoodSimple({ picks, still, glow }: { picks: (id: string) => ReturnType<typeof titleOf>[]; still: boolean; glow: readonly [number, number] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (still) return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      window.clearInterval(timer);
      if (e?.isIntersecting) timer = window.setInterval(() => setI((x) => (x + 1) % MOODS.length), 3200);
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [still]);
  const m = MOODS[i]!;
  return (
    <div
      ref={ref}
      className="rounded-[10px] p-6 transition-[background] duration-1000"
      style={{ background: `radial-gradient(circle at 30% 20%, rgb(${m.wash[0]} / ${glow[0]}), transparent 60%), radial-gradient(circle at 80% 90%, rgb(${m.wash[1]} / ${glow[1]}), transparent 60%)` }}
    >
      <ul aria-label="Moods" className="flex flex-wrap gap-2">
        {MOODS.map((x, k) => (
          <li key={x.id} className={cn("rounded-full border px-3.5 py-1.5 text-[0.875rem] transition-colors duration-500", k === i ? "border-text text-text" : "border-hairline-strong text-muted")}>
            {x.label}
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="mt-6 flex justify-center gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {picks(m.id).map((t, k) => (
            <motion.div
              key={`${m.id}-${t!.key}`}
              className="relative aspect-[2/3] w-[28%] overflow-hidden rounded-[4px]"
              initial={{ y: 60, rotate: -8, opacity: 0 }}
              animate={{ y: 0, rotate: (k - 1) * 4, opacity: 1 }}
              exit={{ x: 80, opacity: 0 }}
              transition={{ duration: 0.6, delay: k * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <Image src={tmdbImg(t!.posterPath)!} alt="" fill sizes="30vw" className="object-cover" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
