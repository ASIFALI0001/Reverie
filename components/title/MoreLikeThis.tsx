"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import { Rail } from "@/components/rails/Rail";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { PosterCard } from "@/components/title/PosterCard";
import { WhyPopover } from "@/components/title/WhyPopover";
import { WHY_LINK_BELOW } from "@/components/title/WhyNot";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSimilar } from "@/lib/api/match";
import { cardMeta } from "@/lib/catalog/cards";
import { tmdbImg } from "@/lib/images/tmdb";
import type { MediaType } from "@/lib/catalog/types";

const CARD_W = "w-[clamp(9.5rem,15vw,13.75rem)]";

/**
 * Twelve titles that feel like this one (brief §5.4), each with a line on why,
 * plus the viewer's own match. Fetched as it nears the viewport: curation is a
 * Gemini call on a cold cache, so crawlers and the build never pay for it.
 */
export function MoreLikeThis({ mediaType, tmdbId }: { mediaType: MediaType; tmdbId: number }) {
  const ref = useRef<HTMLElement>(null);
  const near = useInView(ref, { once: true, margin: "1000px 0px" });
  const similar = useSimilar(mediaType, tmdbId, near);
  const items = similar.data?.items ?? [];

  if (similar.isError || (similar.isSuccess && items.length === 0)) return null;
  return (
    <section ref={ref} className="border-t border-hairline py-[var(--section-y)]" aria-busy={!similar.isSuccess}>
      {similar.isSuccess ? (
        <Rail label="More like this" heading={<SplitHeading className="text-h2">More like this</SplitHeading>}>
          {items.map((i) => (
            <li key={i.key} className={`${CARD_W} shrink-0`}>
              <PosterCard
                href={i.card.href}
                title={i.card.title}
                titleKey={i.card.key}
                posterPath={i.card.posterPath}
                posterSrc={tmdbImg(i.card.posterPath)!}
                blur={i.card.posterBlur}
                color={i.card.color ?? undefined}
                year={i.card.year}
                meta={cardMeta(i.card)}
                match={i.match}
              />
              <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[0.8125rem] leading-snug text-muted">{i.why}</p>
              {i.match != null && i.match < WHY_LINK_BELOW ? (
                <WhyPopover mediaType={i.card.mediaType} tmdbId={i.card.tmdbId} title={i.card.title} href={i.card.href} className="mt-1 inline-block" />
              ) : null}
            </li>
          ))}
        </Rail>
      ) : (
        <div className="page" aria-hidden="true">
          <Skeleton className="h-12 w-64" />
          <div className="mt-10 flex gap-[var(--gutter)] overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${CARD_W} shrink-0`}>
                <Skeleton className="aspect-[2/3] w-full" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
