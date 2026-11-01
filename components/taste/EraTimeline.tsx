"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { MorphRadar } from "@/components/taste/MorphRadar";
import { loadGsap } from "@/lib/fx/gsap";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import type { EraView } from "@/lib/api/timeline";

const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Mar 2025 – Jun 2025", or one month on its own. */
export function eraRange(e: Pick<EraView, "start" | "end">) {
  const a = month(new Date(e.start));
  const b = month(new Date(new Date(e.end).getTime() - 1));
  return a === b ? a : `${a} – ${b}`;
}

export const stars = (rating: number | null) => (rating == null ? "—" : `★ ${(rating / 2).toFixed(1)}`);

/**
 * Your eras, oldest first. On a wide screen the cards ride a horizontal track while the page is
 * pinned, and one radar reshapes into each era as it arrives. On phones, with reduced motion, or
 * with a single era, it's a plain list where each era's radar grows out of the one before it.
 */
export function EraTimeline({ eras }: { eras: EraView[] }) {
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  if (wide && !reduced && eras.length > 1) return <PinnedEras eras={eras} />;
  return <ListedEras eras={eras} />;
}

/** `dim`: not the era in focus on the track (text steps down to muted ink, never below contrast). */
function EraCard({ era, index, total, dim = false }: { era: EraView; index: number; total: number; dim?: boolean }) {
  return (
    <article aria-labelledby={`era-${index}`}>
      <p className="text-meta text-muted [font-variant-numeric:tabular-nums]">
        Era {index + 1} of {total} · {eraRange(era)}
      </p>
      <h3 id={`era-${index}`} className={cn("mt-2 font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.02] transition-colors duration-500", dim && "text-muted")}>
        {era.name}
      </h3>
      <p className="mt-3 max-w-[44ch] text-[1.0625rem] leading-snug text-text/90">{era.line}</p>
      {era.genres.length ? (
        <ul aria-label="What you watched most" className="mt-5 flex flex-wrap gap-2">
          {era.genres.slice(0, 4).map((g) => (
            <li key={g.term} className="rounded-full border border-hairline-strong px-3 py-1 text-[0.8125rem] text-muted">
              {g.term} <span className="text-text [font-variant-numeric:tabular-nums]">{Math.round(g.value * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="mt-6 grid max-w-md grid-cols-3 gap-4 border-t border-hairline pt-4">
        {(
          [
            ["Titles", String(era.count)],
            ["Hours", String(Math.round(era.hours))],
            ["Average", stars(era.avgRating)],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="text-meta text-muted">{k}</dt>
            <dd className="numeral mt-1 text-[1.375rem]">{v}</dd>
          </div>
        ))}
      </dl>
      {era.topTitles.some((t) => t.posterPath && t.href) ? (
        <ul aria-label={`Favourites from ${era.name}`} className={cn("mt-6 flex gap-3 transition-opacity duration-500", dim && "opacity-45")}>
          {era.topTitles
            .filter((t) => t.posterPath && t.href)
            .slice(0, 4)
            .map((t) => (
              <li key={t.key}>
                <Link href={t.href!} className="group relative block aspect-[2/3] w-[4.25rem] overflow-hidden rounded-[2px] bg-surface">
                  <Image src={tmdbImg(t.posterPath, "thumb")!} alt={t.title} fill sizes="68px" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                </Link>
              </li>
            ))}
        </ul>
      ) : null}
      {era.shift != null && era.shift > 0.5 ? <p className="mt-4 text-meta text-muted">More than half of what you watched changed from the era before.</p> : null}
    </article>
  );
}

function ListedEras({ eras }: { eras: EraView[] }) {
  return (
    <ol className="page mt-10 border-t border-hairline">
      {eras.map((era, i) => (
        <li key={era.start} className="grid gap-6 border-b border-hairline py-12 md:grid-cols-[15rem_minmax(0,1fr)] md:items-center md:gap-12">
          <MorphRadar points={era.radar} from={eras[i - 1]?.radar ?? null} when="view" label={`${era.name}, genre radar`} className="mx-auto max-w-[15rem] md:mx-0" />
          <EraCard era={era} index={i} total={eras.length} />
        </li>
      ))}
    </ol>
  );
}

function PinnedEras({ eras }: { eras: EraView[] }) {
  const root = useRef<HTMLDivElement>(null);
  const span = useRef<{ start: number; end: number } | null>(null);
  const [active, setActive] = useState(0);
  const n = eras.length;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        const track = el.querySelector<HTMLElement>("[data-track]")!;
        const viewport = el.querySelector<HTMLElement>("[data-viewport]")!;
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: () => `+=${Math.max(distance(), window.innerHeight * 0.6 * (n - 1))}`,
            pin: el.querySelector("[data-stage]"),
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: (self) => void (span.current = { start: self.start, end: self.end }),
            onUpdate: (self) => {
              span.current = { start: self.start, end: self.end };
              const i = Math.round(self.progress * (n - 1));
              setActive((a) => (a === i ? a : i));
            },
          },
        });
      }, el);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [n]);

  // Keyboard focus inside an era that's off to the side: scroll to where that era is in view.
  function reveal(i: number) {
    const s = span.current;
    if (s && i !== active) window.scrollTo({ top: s.start + ((s.end - s.start) * i) / (n - 1) + 1 });
  }

  const era = eras[active]!;
  return (
    <div ref={root}>
      <div data-stage className="flex h-svh items-center overflow-hidden pt-[var(--nav-h)]">
        <div className="page grid w-full grid-cols-[minmax(0,20rem)_minmax(0,1fr)] items-center gap-14">
          <div aria-hidden="true">
            <p className="text-meta text-muted [font-variant-numeric:tabular-nums]">
              Era {active + 1} of {n}
            </p>
            <MorphRadar points={era.radar} label={`${era.name}, genre radar`} className="mt-2" />
            <ol className="mt-4 space-y-1.5 border-l border-hairline pl-4">
              {eras.map((e, i) => (
                <li key={e.start} className={cn("text-meta transition-colors duration-300", i === active ? "text-text" : "text-muted")}>
                  {e.name}
                </li>
              ))}
            </ol>
          </div>
          <div data-viewport className="overflow-hidden [mask-image:linear-gradient(to_right,black_80%,transparent)]">
            <ol data-track className="flex w-max gap-14 pr-[20vw]">
              {eras.map((e, i) => (
                <li key={e.start} onFocus={() => reveal(i)} className="w-[min(34rem,52vw)] shrink-0">
                  <EraCard era={e} index={i} total={n} dim={i !== active} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
