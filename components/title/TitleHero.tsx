"use client";

import Image from "next/image";
import { useEffect, useRef, useState, ViewTransition, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Play } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { RiseHeading } from "@/components/motion/RiseHeading";
import { MetaLine } from "@/components/title/MetaLine";
import { RatingsStrip } from "@/components/title/RatingsStrip";
import { TitleMatch } from "@/components/title/TitleMatch";
import { TrailerModal, preloadTrailer } from "@/components/ui/LazyDialogs";
import { POSTER_SIZES } from "@/components/title/PosterCard";
import { useOpenOnce } from "@/lib/hooks/use-open-once";
import { posterTransitionName, usePendingPoster } from "@/lib/store/pending-poster";
import { tmdbImg } from "@/lib/images/tmdb";
import { formatRuntime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TitlePageData } from "@/lib/title-page";

type HeroProps = {
  data: Pick<
    TitlePageData,
    | "key"
    | "tmdbId"
    | "mediaType"
    | "category"
    | "title"
    | "year"
    | "runtime"
    | "seasons"
    | "episodes"
    | "genres"
    | "certification"
    | "directors"
    | "creators"
    | "posterPath"
    | "backdropPath"
    | "posterBlur"
    | "ratings"
    | "videos"
    | "originCountry"
    | "slug"
  >;
  certRegion: string;
  /** Library / watchlist controls (wired in Phase 5). */
  actions?: ReactNode;
};

// Matches the poster slot: 6.75rem on phones, clamp(7.5rem, 11vw, 10.5rem) from md.
const HERO_POSTER_SIZES = "(min-width: 768px) 168px, 108px";

/** Long titles step down a size so they never break into four lines. */
export function titleSize(title: string) {
  if (title.length > 34) return "text-h1";
  if (title.length > 18) return "text-[clamp(3rem,1.2rem+6.4vw,8.25rem)] leading-[0.88] tracking-[-0.03em]";
  return "text-display";
}

export function TitleHero({ data, certRegion, actions }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "16%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, reduced ? 1.05 : 1.12]);
  const [trailerOpen, setTrailerOpen, trailerMounted] = useOpenOnce();

  // Arriving through the poster morph: the shell already showed this title, so don't re-animate it.
  const pending = usePendingPoster((s) => s.pending);
  const clearPending = usePendingPoster((s) => s.set);
  const [cameFromMorph] = useState(() => pending?.key === data.key);
  useEffect(() => {
    if (pending?.key === data.key) clearPending(null);
  }, [pending, data.key, clearPending]);

  const trailer = data.videos.find((v) => v.type === "Trailer") ?? data.videos[0] ?? null;
  const cert = data.certification[certRegion] ?? data.certification.US ?? null;
  const people = data.mediaType === "tv" && data.creators.length ? data.creators : data.directors;
  const credit = people.length ? `${data.mediaType === "tv" && data.creators.length ? "Created by" : "Directed by"} ${people.map((p) => p.name).join(", ")}` : null;
  const meta = [
    data.year ? String(data.year) : null,
    data.mediaType === "tv"
      ? [data.seasons ? `${data.seasons} season${data.seasons === 1 ? "" : "s"}` : null, data.episodes ? `${data.episodes} episodes` : null]
          .filter(Boolean)
          .join(", ") || null
      : formatRuntime(data.runtime),
    cert,
    data.genres.slice(0, 3).join(", ") || null,
  ];
  const backdrop = tmdbImg(data.backdropPath, "backdrop");
  const poster = tmdbImg(data.posterPath);

  return (
    <section ref={ref} className="relative isolate overflow-hidden md:flex md:min-h-[max(100svh,720px)] md:flex-col md:justify-end">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-20 h-[62svh] overflow-hidden md:inset-0 md:h-auto">
        <motion.div className="absolute inset-0" style={{ y, scale }}>
          {backdrop ? (
            <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover object-[50%_25%] opacity-75" />
          ) : poster ? (
            <Image src={poster} alt="" fill sizes="100vw" className="scale-125 object-cover opacity-40 blur-2xl" />
          ) : null}
        </motion.div>
        <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_55%_30%,transparent_35%,var(--color-bg)_92%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-linear-to-t from-bg via-bg/85 to-transparent md:h-[62%]" />
        {/* Projector masking opening on first paint: CSS, so it runs before (and without) hydration. */}
        {cameFromMorph ? null : (
          <>
            <div className="letterbox absolute inset-x-0 top-0 h-1/2 origin-top bg-black" />
            <div className="letterbox absolute inset-x-0 bottom-0 h-1/2 origin-bottom bg-black" />
          </>
        )}
      </div>

      {/* Film edge code along the right margin. */}
      <p
        aria-hidden="true"
        className="numeral absolute right-[calc(var(--page-x)*0.45)] top-1/2 hidden -translate-y-1/2 text-[0.625rem] uppercase tracking-[0.3em] text-muted/70 [writing-mode:vertical-rl] lg:block"
      >
        REVERIE ▸ {data.tmdbId} ● {data.year ?? "—"} ● {data.runtime ? `${data.runtime} MIN` : data.mediaType === "tv" ? "SERIES" : "—"} ●{" "}
        {data.originCountry[0] ?? "—"}
      </p>

      <div className="page relative pb-12 pt-[38svh] md:pb-16 md:pt-[calc(var(--nav-h)+2rem)]">
        <div className="title-hero-grid">
          <ViewTransition name={posterTransitionName(data.key)} share="morph" default="none">
            <div
              data-hero-poster={data.key}
              className="relative aspect-[2/3] w-[6.75rem] overflow-hidden rounded-[var(--radius-poster)] bg-surface [grid-area:poster] md:w-[clamp(7.5rem,11vw,10.5rem)]"
            >
              {poster ? (
                <Image
                  src={poster}
                  alt={`${data.title}${data.year ? ` (${data.year})` : ""} poster`}
                  fill
                  // After a morph, reuse the card's size (already cached); otherwise fetch what this slot needs.
                  // The backdrop is the LCP, so the poster doesn't compete for priority.
                  sizes={cameFromMorph ? POSTER_SIZES : HERO_POSTER_SIZES}
                  loading="eager"
                  placeholder={data.posterBlur ? "blur" : "empty"}
                  blurDataURL={data.posterBlur ?? undefined}
                  className="object-cover"
                />
              ) : null}
            </div>
          </ViewTransition>

          <div className="min-w-0 [grid-area:title]">
            {cameFromMorph ? (
              <h1 className={titleSize(data.title)}>{data.title}</h1>
            ) : (
              <RiseHeading delay={0.45} className={titleSize(data.title)}>
                {data.title}
              </RiseHeading>
            )}
            <MetaLine className="mt-5" items={meta} />
            {credit ? <p className="mt-2 text-[0.9375rem] text-text/80">{credit}</p> : null}
          </div>

          <div className="flex justify-end [grid-area:ring] md:self-center">
            <TitleMatch mediaType={data.mediaType} tmdbId={data.tmdbId} path={`/title/${data.mediaType}/${data.slug}`} />
          </div>

          <RatingsStrip ratings={data.ratings} isAnime={data.category === "anime"} />

          <div className={cn("flex flex-wrap items-center gap-3 [grid-area:actions]")}>
            {actions}
            {trailer ? (
              <Button variant="secondary" data-cursor="play" onPointerEnter={preloadTrailer} onFocus={preloadTrailer} onClick={() => setTrailerOpen(true)}>
                <Play size={16} weight="fill" aria-hidden="true" /> Trailer
              </Button>
            ) : null}
            <Button asChild variant="ghost" className="link-draw rounded-none px-1">
              <a href="#where-to-watch">Where to watch</a>
            </Button>
          </div>
        </div>
      </div>
      {trailerMounted ? (
        <TrailerModal videoId={trailer?.key ?? null} title={`${data.title} trailer`} open={trailerOpen} onOpenChange={setTrailerOpen} />
      ) : null}
    </section>
  );
}
