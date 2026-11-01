"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MatchBadge } from "@/components/title/MatchRing";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { spring } from "@/lib/motion";

// Shelves inside each category, as the real library builds them.
const SHELVES: Record<keyof typeof CAST.shelves, string> = { Movies: "Marvel", Series: "Prestige drama", Anime: "Studio Ghibli & friends", Cartoons: "Animated worlds" };
const WATCH_MATCH = [74, 92, 81, 88, 69];

/**
 * 10 · Your library. The one horizontal scene: the page pins and scrolling moves sideways through
 * Movies → Series → Anime → Cartoons, posters sliding onto each shelf as it arrives; halfway
 * through, the watchlist beside it re-sorts itself by match (a layout animation). Phones: the
 * shelves stack and the watchlist sorts once it's in view. Reduced motion: shelves, sorted.
 */
export default function Library({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const [sorted, setSorted] = useState(!!reduced);
  const shelves = (Object.keys(CAST.shelves) as (keyof typeof CAST.shelves)[]).map((cat) => ({
    cat,
    shelf: SHELVES[cat],
    items: CAST.shelves[cat].map((k) => titleOf(data, k)).filter((t) => t?.posterPath),
  }));
  const watch = CAST.watchlist.map((k, i) => ({ t: titleOf(data, k), m: WATCH_MATCH[i]! })).filter((w) => w.t?.posterPath);
  const order = sorted ? [...watch].sort((a, b) => b.m - a.m) : watch;

  useGsapScene(ref, wide && !reduced, "wide", ({ gsap }, root, el) => {
    const track = el.querySelector<HTMLElement>("[data-track]")!;
    const viewport = el.querySelector<HTMLElement>("[data-viewport]")!;
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => setSorted(self.progress > 0.5),
      },
    });
    tl.to(track, { x: () => -distance(), duration: 1 }, 0);
    el.querySelectorAll<HTMLElement>("[data-panel]").forEach((panel, i, all) => {
      tl.from(panel.querySelectorAll("[data-book]"), { y: 70, opacity: 0, rotate: 4, duration: 0.12, stagger: 0.02, ease: "power3.out" }, Math.max(0, (i / all.length) * 0.9 - 0.05));
    });
  });

  // Phones: sort once the watchlist is on screen.
  useEffect(() => {
    if (wide || reduced) return;
    const el = ref.current?.querySelector("[data-watch]");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && window.setTimeout(() => setSorted(true), 900), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [wide, reduced]);

  return (
    <div ref={ref} className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
      <div data-viewport className="overflow-hidden">
        <div data-track className="flex w-full flex-col gap-10 lg:w-max lg:flex-row lg:gap-16 lg:pr-[10vw]">
          {shelves.map((s) => (
            <section key={s.cat} data-panel aria-label={s.cat} className="lg:w-[34rem]">
              <p className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-none">{s.cat}</p>
              <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{s.shelf}</p>
              <ul className="mt-4 flex gap-3">
                {s.items.slice(0, 5).map((t) => (
                  <li key={t!.key} data-book className="relative aspect-[2/3] w-[clamp(4rem,9vw,6rem)] shrink-0 overflow-hidden rounded-[2px] bg-surface shadow-[0_14px_30px_rgb(0_0_0/0.35)]">
                    <Image src={tmdbImg(t!.posterPath, "thumb")!} alt={t!.title} fill sizes="96px" className="object-cover" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <aside data-watch aria-label="Your watchlist, ranked by match" className="rounded-[6px] border border-hairline bg-surface/70 p-4">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">Watchlist · by match</p>
        <ol className="mt-3 space-y-2">
          {order.map((w) => (
            <motion.li key={w.t!.key} layout={!reduced} transition={spring.soft} className="flex items-center gap-2.5">
              <span className="relative aspect-[2/3] w-7 shrink-0 overflow-hidden rounded-[2px] bg-raised">
                <Image src={tmdbImg(w.t!.posterPath, "thumb")!} alt="" fill sizes="28px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.875rem]">{w.t!.title}</span>
              <MatchBadge value={w.m} className="bg-text/[0.06]" />
            </motion.li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
