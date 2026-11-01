"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Rail } from "@/components/rails/Rail";
import { MatchMini, MatchRing } from "@/components/title/MatchRing";
import { PosterCard } from "@/components/title/PosterCard";
import { HeroActions } from "@/components/title/HeroActions";
import { InvitePrompt } from "@/components/social/InvitePrompt";
import { SentToYouRail } from "@/components/social/SentToYou";
import { MoodCard } from "@/components/mood/MoodCard";
import { FriendsLately } from "@/components/social/ActivityStrip";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useHomeFeed } from "@/lib/api/home";
import { cardMeta } from "@/lib/catalog/cards";
import { tmdbImg } from "@/lib/images/tmdb";
import { ease } from "@/lib/motion";
import type { HomeRow, Tonight } from "@/lib/home/types";

const CARD_W = "w-[clamp(8.75rem,38vw,13.75rem)] md:w-[clamp(9.5rem,15vw,13.75rem)]";

export function HomeFeed() {
  return (
    <AuthGuard fallback={<FeedSkeleton />}>
      <Feed />
    </AuthGuard>
  );
}

function Feed() {
  const feed = useHomeFeed();
  const data = feed.data;
  // Friends' sections and the mood card have their own quick queries, so they show as soon as
  // they're ready instead of waiting for the personal feed (the slow part on a cold cache).
  return (
    <>
      {data && !data.personal ? <TasteNudge /> : null}
      <InvitePrompt />
      {feed.isPending ? <TonightSkeleton /> : data?.tonight ? <TonightFeature t={data.tonight} /> : null}
      <MoodCard />
      <SentToYouRail />
      <FriendsLately />
      {feed.isPending ? (
        <RowsSkeleton />
      ) : data ? (
        data.rows.map((row) => <HomeRail key={row.id} row={row} />)
      ) : (
        <div className="page mt-12 max-w-xl">
          <p className="font-display text-h3">The feed didn’t load.</p>
          <p className="mt-3 text-muted">Check your connection and try again.</p>
          <Button className="mt-6" onClick={() => feed.refetch()}>
            Try again
          </Button>
        </div>
      )}
    </>
  );
}

/** The one pick the evening leads with: a wide still, the reason, and the dial. */
function TonightFeature({ t }: { t: Tonight }) {
  const reduced = useReducedMotion();
  const c = t.card;
  const meta = [c.year, cardMeta(c), c.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
  const style = (t.tint ? { "--tint-dark": t.tint.dark, "--tint-light": t.tint.light } : {}) as CSSProperties;
  return (
    <section aria-labelledby="tonight" className="title-page page mt-8 md:mt-12" style={style}>
      <motion.div
        className="relative overflow-hidden rounded-[6px] bg-surface"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: ease.out }}
      >
        <div className="relative aspect-[16/10] md:aspect-[2.39/1]">
          {t.backdropPath ? (
            <Image
              src={tmdbImg(t.backdropPath, "backdrop")!}
              alt=""
              fill
              priority
              sizes="(min-width: 1440px) 1340px, 100vw"
              className="object-cover"
            />
          ) : null}
          <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-surface via-surface/20 to-transparent md:bg-linear-to-r md:from-bg/95 md:via-bg/55 md:to-transparent" />
          <div aria-hidden="true" className="absolute inset-0 hidden bg-linear-to-t from-bg/80 via-transparent to-transparent md:block" />
        </div>

        <div className="relative grid gap-6 p-5 md:absolute md:inset-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-10">
          <div className="max-w-xl">
            <div className="flex items-center justify-between gap-4">
              <p className="caption text-muted">Tonight</p>
              <MatchMini value={t.match} className="md:hidden" />
            </div>
            <h2 id="tonight" className="mt-2 font-display text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95]">
              <Link href={c.href} className="transition-colors hover:text-[var(--tint)]">
                {c.title}
              </Link>
            </h2>
            <p className="mt-3 text-meta text-muted [font-variant-numeric:tabular-nums]">{meta}</p>
            <p className="mt-4 max-w-[46ch] font-display text-[clamp(1.125rem,1.6vw,1.375rem)] leading-snug">{t.reason}.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <HeroActions mediaType={c.mediaType} tmdbId={c.tmdbId} title={c.title} posterPath={c.posterPath} path={c.href} />
              <Button asChild variant="ghost">
                <Link href={c.href}>Open</Link>
              </Button>
            </div>
          </div>
          <MatchRing value={t.match} note="Your best match tonight" delay={0.4} className="hidden w-[clamp(9rem,13vw,12rem)] md:block" />
        </div>
      </motion.div>
    </section>
  );
}

function HomeRail({ row }: { row: HomeRow }) {
  const heading = (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      <h2 className="font-display text-h3">
        {row.title}
        {row.emphasis ? (
          <>
            {" "}
            {row.href && row.kind === "because" ? (
              <Link href={row.href} className="italic transition-colors hover:text-[var(--color-accent)]">
                {row.emphasis}
              </Link>
            ) : (
              <em>{row.emphasis}</em>
            )}
          </>
        ) : null}
      </h2>
      {row.href && row.kind !== "because" ? (
        <Link href={row.href} className="link-draw text-meta text-muted hover:text-text">
          See all
        </Link>
      ) : null}
    </div>
  );
  return (
    <section className="py-[calc(var(--section-y)*0.4)]">
      <Rail label={row.emphasis ? `${row.title} ${row.emphasis}` : row.title} heading={heading}>
        {row.items.map(({ card: c, match, note }) => (
          <li key={c.key} className={`${CARD_W} shrink-0`}>
            <PosterCard
              href={c.href}
              title={c.title}
              titleKey={c.key}
              posterPath={c.posterPath}
              posterSrc={tmdbImg(c.posterPath)!}
              blur={c.posterBlur}
              color={c.color ?? undefined}
              year={c.year}
              meta={cardMeta(c)}
              note={note}
              match={match}
            />
          </li>
        ))}
      </Rail>
    </section>
  );
}

function TasteNudge() {
  return (
    <section className="page mt-10">
      <div className="grid gap-6 rounded-[6px] border border-hairline-strong p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10">
        <div>
          <p className="caption text-muted">Your matches start here</p>
          <p className="mt-2 max-w-[30ch] font-display text-h3">Two minutes of swiping, and every title gets a number that’s yours.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/onboarding?rerun=1">Take the taste quiz</Link>
        </Button>
      </div>
    </section>
  );
}

function TonightSkeleton() {
  return (
    <div aria-hidden="true" className="page mt-8 md:mt-12">
      <Skeleton className="aspect-[16/10] w-full rounded-[6px] md:aspect-[2.39/1]" />
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1].map((r) => (
        <div key={r} className="page mt-14">
          <Skeleton className="h-8 w-72" />
          <div className="mt-6 flex gap-[var(--gutter)] overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className={`${CARD_W} aspect-[2/3] shrink-0`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <>
      <TonightSkeleton />
      <RowsSkeleton />
    </>
  );
}
