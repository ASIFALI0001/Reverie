"use client";

import Image from "next/image";
import { ViewTransition } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchDialEmpty } from "@/components/title/MatchRing";
import { POSTER_SIZES } from "@/components/title/PosterCard";
import { titleSize } from "@/components/title/TitleHero";
import { posterTransitionName, usePendingPoster, type PendingPoster } from "@/lib/store/pending-poster";
import { idFromSlug } from "@/lib/catalog/links";
import { tmdbImg } from "@/lib/images/tmdb";

/**
 * The title page's instant shell. When the visitor arrived by clicking a poster,
 * that poster is drawn here — in the hero's exact slot, under the same transition
 * name — so the morph happens on click, before the title's data has streamed in.
 */
export function HeroPlaceholder({ generic = false }: { generic?: boolean }) {
  return generic ? <Shell p={null} /> : <PendingShell />;
}

/** Reads the route params (known on client navigations), so it sits inside its own boundary. */
function PendingShell() {
  const params = useParams<{ mediaType?: string; slug?: string }>();
  const pending = usePendingPoster((s) => s.pending);
  const key = params.mediaType && params.slug ? `${params.mediaType}:${idFromSlug(params.slug)}` : null;
  return <Shell p={pending && pending.key === key ? pending : null} />;
}

function Shell({ p }: { p: PendingPoster | null }) {

  return (
    <div aria-busy="true" aria-label={p ? `Loading ${p.title}` : "Loading title"}>
      <section className="relative isolate overflow-hidden md:flex md:min-h-[max(100svh,720px)] md:flex-col md:justify-end">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-20 h-[62svh] overflow-hidden md:inset-0 md:h-auto">
          {p ? (
            // The poster itself, blown up and blurred, stands in for the backdrop's colour.
            <Image src={tmdbImg(p.posterPath)!} alt="" fill sizes={POSTER_SIZES} className="scale-125 object-cover opacity-30 blur-3xl" />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_55%_30%,transparent_35%,var(--color-bg)_92%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-linear-to-t from-bg via-bg/85 to-transparent md:h-[62%]" />
        </div>
        <div className="page relative pb-12 pt-[38svh] md:pb-16 md:pt-[calc(var(--nav-h)+2rem)]">
          <div className="title-hero-grid">
            {p ? (
              <ViewTransition name={posterTransitionName(p.key)} share="morph" default="none">
                <div className="relative aspect-[2/3] w-[6.75rem] overflow-hidden rounded-[var(--radius-poster)] bg-surface [grid-area:poster] md:w-[clamp(7.5rem,11vw,10.5rem)]">
                  <Image
                    src={tmdbImg(p.posterPath)!}
                    alt=""
                    fill
                    sizes={POSTER_SIZES}
                    loading="eager"
                    placeholder={p.blur ? "blur" : "empty"}
                    blurDataURL={p.blur ?? undefined}
                    className="object-cover"
                  />
                </div>
              </ViewTransition>
            ) : (
              <Skeleton className="aspect-[2/3] w-[6.75rem] [grid-area:poster] md:w-[clamp(7.5rem,11vw,10.5rem)]" />
            )}
            <div className="min-w-0 [grid-area:title]">
              {p ? (
                <p className={`font-display opacity-90 ${titleSize(p.title)}`}>{p.title}</p>
              ) : (
                <Skeleton className="h-[clamp(3rem,10vw,9rem)] w-3/4" />
              )}
              <Skeleton className="mt-5 h-4 w-64" />
            </div>
            <div className="flex justify-end [grid-area:ring] md:self-center">
              <MatchDialEmpty loading className="w-[min(10rem,42vw)] md:w-[clamp(13rem,25vw,22.5rem)]" />
            </div>
            <div className="flex gap-8 border-t border-hairline pt-6 [grid-area:ratings]">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-20" />
              ))}
            </div>
            <div className="flex gap-3 [grid-area:actions]">
              <Skeleton className="h-11 w-36 rounded-full" />
              <Skeleton className="h-11 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>
      <div className="page grid-editorial gap-y-6 py-[var(--section-y)]" aria-hidden="true">
        <div className="col-span-12 space-y-4 lg:col-span-7">
          <Skeleton className="h-12 w-56" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      </div>
    </div>
  );
}
