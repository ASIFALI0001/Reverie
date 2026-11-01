"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { BookmarkSimple, Play, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { CountUp } from "@/components/motion/CountUp";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { MatchRing } from "@/components/title/MatchRing";
import { MetaLine } from "@/components/title/MetaLine";
import { ease } from "@/lib/motion";

const RATINGS = [
  { k: "IMDb", v: 8.3, d: 1, extra: "190K votes" },
  { k: "Rotten Tomatoes", v: 97, d: 0, suffix: "%" },
  { k: "Metacritic", v: 98, d: 0 },
  { k: "TMDB", v: 8.1, d: 1 },
];

/** Prototype of the title-page hero (Phase 4), on public-domain material. */
export function DemoHero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "16%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, reduced ? 1.05 : 1.12]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden md:flex md:min-h-[max(100svh,720px)] md:flex-col md:justify-end">
      {/* Backdrop: the upper ~60% on phones, full-bleed from md up. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-20 h-[62svh] overflow-hidden md:inset-0 md:h-auto">
        <motion.div className="absolute inset-0" style={{ y, scale }}>
          <Image
            src="/demo/metropolis-still.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_22%] opacity-80"
          />
        </motion.div>
        <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_55%_30%,transparent_35%,var(--color-bg)_92%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-linear-to-t from-bg via-bg/85 to-transparent md:h-[62%]" />

        {/* Projector masking opening on first paint. */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1/2 origin-top bg-black"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 1.4, ease: ease.inOut, delay: 0.1 }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 h-1/2 origin-bottom bg-black"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 1.4, ease: ease.inOut, delay: 0.1 }}
        />
      </div>

      {/* Film edge code along the right margin. */}
      <p
        aria-hidden="true"
        className="numeral absolute right-[calc(var(--page-x)*0.45)] top-1/2 hidden -translate-y-1/2 text-[0.625rem] tracking-[0.3em] text-muted/70 [writing-mode:vertical-rl] lg:block"
      >
        REVERIE ▸ 19644 ● 1927 ● 153 MIN ● DE
      </p>

      <div className="page relative pb-12 pt-[38svh] md:pb-16 md:pt-[calc(var(--nav-h)+2rem)]">
        <div className="title-hero-grid">
          <div className="relative aspect-[2/3] w-[6.75rem] overflow-hidden rounded-[var(--radius-poster)] bg-surface [grid-area:poster] md:w-[clamp(7.5rem,11vw,10.5rem)]">
            <Image
              src="/demo/metropolis.jpg"
              alt="Metropolis (1927) poster"
              fill
              sizes="(min-width: 768px) 170px, 108px"
              loading="eager"
              fetchPriority="high"
              className="object-cover"
            />
          </div>

          <div className="min-w-0 [grid-area:title]">
            <SplitHeading as="h1" trigger="mount" delay={0.55} className="text-display">
              Metropolis
            </SplitHeading>
            <MetaLine
              className="mt-5"
              items={["1927", "2h 33m", "Sci-fi, Drama", <span key="d" className="text-text/80">Fritz Lang</span>]}
            />
          </div>

          <div className="flex justify-end [grid-area:ring] md:self-center">
            <MatchRing
              value={87}
              note="Because you loved Sunrise and Caligari"
              delay={0.9}
              className="w-[min(10rem,42vw)] md:w-[clamp(13rem,25vw,22.5rem)]"
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-hairline pt-6 [grid-area:ratings] sm:flex sm:flex-wrap">
            {RATINGS.map((r) => (
              <div key={r.k} className="min-w-[6.5rem]">
                <dt className="caption">{r.k}</dt>
                <dd className="mt-1 flex items-baseline gap-2">
                  <CountUp value={r.v} decimals={r.d} suffix={r.suffix} delay={1} className="text-[1.625rem] font-light leading-none" />
                  {r.extra ? <span className="text-meta text-muted">{r.extra}</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-3 [grid-area:actions]">
            <Button>
              <Plus size={18} weight="light" aria-hidden="true" /> Add to library
            </Button>
            <Button variant="secondary">
              <BookmarkSimple size={18} weight="light" aria-hidden="true" /> Watchlist
            </Button>
            <Button variant="secondary" data-cursor="play">
              <Play size={16} weight="fill" aria-hidden="true" /> Trailer
            </Button>
            <Button variant="ghost" className="link-draw rounded-none px-1">
              Where to watch
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
