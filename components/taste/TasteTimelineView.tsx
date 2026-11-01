"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Sparkle, UsersThree } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CountUp } from "@/components/motion/CountUp";
import { RiseHeading } from "@/components/motion/RiseHeading";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { TasteDnaCard } from "@/components/taste/TasteDnaCard";
import { EraTimeline } from "@/components/taste/EraTimeline";
import { GenreStack } from "@/components/taste/GenreStack";
import { ShareTasteButton } from "@/components/taste/ShareTaste";
import { useTaste } from "@/lib/api/taste";
import { useTimeline, type TimelineView } from "@/lib/api/timeline";

export function TasteTimelineView() {
  return (
    <div className="pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <AuthGuard fallback={<TimelineSkeleton />}>
        <Timeline />
      </AuthGuard>
    </div>
  );
}

/** Wrapped season: from mid-December to mid-January it's the headline; otherwise a quiet preview. */
function useWrappedSeason() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const d = new Date();
      return (d.getMonth() === 11 && d.getDate() >= 15) || (d.getMonth() === 0 && d.getDate() <= 15);
    },
    () => false,
  );
}

function Timeline() {
  const taste = useTaste();
  const timeline = useTimeline();
  const season = useWrappedSeason();
  if (taste.isPending || timeline.isPending) return <TimelineSkeleton />;
  if (taste.isError || timeline.isError) {
    return (
      <div className="page max-w-xl">
        <p className="font-display text-h3">Your timeline didn’t load.</p>
        <p className="mt-3 text-muted">Check your connection and try again.</p>
        <Button className="mt-6" onClick={() => void Promise.all([taste.refetch(), timeline.refetch()])}>
          Try again
        </Button>
      </div>
    );
  }
  const t = timeline.data;
  const wrappedYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  return (
    <>
      <header className="page">
        <p className="caption text-muted">Your taste</p>
        <RiseHeading className="mt-3 max-w-[16ch] text-h1">How your taste has moved</RiseHeading>
        <div className="mt-8 flex flex-wrap gap-2">
          <ShareTasteButton />
          <Button asChild variant="ghost">
            <Link href="/taste/twins">
              <UsersThree size={18} weight="light" aria-hidden="true" /> Your Taste Twins
            </Link>
          </Button>
          {season ? null : (
            <Button asChild variant="ghost">
              <Link href="/taste/wrapped">
                <Sparkle size={18} weight="light" aria-hidden="true" /> Preview Wrapped
              </Link>
            </Button>
          )}
        </div>
      </header>

      {season ? (
        <section className="page mt-10">
          <Link
            href="/taste/wrapped"
            className="group flex items-center justify-between gap-6 rounded-[6px] border border-hairline-strong bg-[radial-gradient(circle_at_12%_0%,rgb(232_162_58/0.16),transparent_60%)] p-6 md:p-8"
          >
            <span>
              <span className="caption block text-muted">It’s that time</span>
              <span className="mt-2 block font-display text-h3">Your {wrappedYear}, wrapped</span>
            </span>
            <span className="text-meta text-text transition-transform duration-300 group-hover:translate-x-1">Play →</span>
          </Link>
        </section>
      ) : null}

      <section className="page mt-14" aria-label="Your Taste DNA">
        {taste.data.status === "ready" ? (
          <TasteDnaCard view={taste.data} />
        ) : (
          <div className="rounded-[6px] border border-hairline-strong p-6 md:p-10">
            <p className="font-display text-h3">Your Taste DNA starts with a two-minute quiz.</p>
            <Button asChild className="mt-6">
              <Link href="/onboarding?rerun=1">Take the taste quiz</Link>
            </Button>
          </div>
        )}
      </section>

      {t.status === "empty" ? (
        <section className="page mt-[var(--section-y)] max-w-2xl">
          <h2 className="text-h2">Your timeline starts with your first logged title</h2>
          <p className="mt-4 text-muted">Add what you’ve watched, with the month you watched it, and your taste eras appear here as they take shape.</p>
          <Button asChild className="mt-6">
            <Link href="/search">Find something you’ve seen</Link>
          </Button>
        </section>
      ) : (
        <>
          <StatsStrip t={t} />
          <section aria-labelledby="eras-heading" className="mt-[var(--section-y)]">
            <div className="page">
              <h2 id="eras-heading" className="text-h2">
                Your eras
              </h2>
              <p className="mt-3 max-w-[56ch] text-muted">
                {t.eras.length === 1
                  ? "One era so far: your taste has held steady. A new one begins when what you watch turns somewhere new."
                  : `${t.eras.length} eras: a new one begins each time what you watch turns somewhere new, and stays a while.`}
              </p>
            </div>
            <EraTimeline eras={t.eras} />
          </section>
          <section aria-labelledby="genres-heading" className="page mt-[var(--section-y)]">
            <h2 id="genres-heading" className="text-h2">
              Month by month
            </h2>
            <p className="mt-3 max-w-[56ch] text-muted">What share of each month went to which genres.</p>
            <GenreStack genres={t.series.genres} months={t.series.months} className="mt-8" />
          </section>
        </>
      )}
    </>
  );
}

function StatsStrip({ t }: { t: TimelineView }) {
  const s = t.stats;
  const since = s.since ? new Date(s.since).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  return (
    <section aria-label="In numbers" className="page mt-[calc(var(--section-y)*0.8)]">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-hairline py-8 md:grid-cols-3">
        <Figure label="Hours watched" value={s.hours} />
        <Figure label="Titles logged" value={s.titles} />
        <Fact label="Most-watched genre" value={s.topGenre?.name} note={s.topGenre ? count(s.topGenre.titles, "title") : "Log a few titles to see it"} />
        <Fact label="Highest rated" value={s.highestRated?.title} href={s.highestRated?.href} note={s.highestRated ? `${s.highestRated.rating}/10` : "Rate a title to see it"} />
        <Fact label="Favourite director" value={s.director?.name} note={s.director ? count(s.director.titles, "film") : "Two films by one director, and they’ll show here"} />
        <Fact
          label="Longest binge"
          value={s.binge?.title}
          href={s.binge?.href}
          note={s.binge ? `${s.binge.episodes} episodes${s.binge.hours ? ` · about ${s.binge.hours} hours` : ""}` : "Finish a series to see it"}
        />
      </dl>
      {since ? <p className="mt-3 text-meta text-muted">Since {since}.</p> : null}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="numeral mt-2 text-[clamp(2rem,4vw,3rem)] leading-none">
        <CountUp value={value} />
      </dd>
    </div>
  );
}

/** A name rather than a number: a title, a genre, a director. */
function Fact({ label, value, note, href }: { label: string; value?: string | null; note: string; href?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="mt-2">
        <p className={value ? "line-clamp-2 font-display text-[clamp(1.5rem,2.6vw,2.125rem)] leading-[1.05]" : "font-display text-[clamp(1.5rem,2.6vw,2.125rem)] leading-[1.05] text-muted"}>
          {value && href ? (
            <Link href={href} className="link-draw">
              {value}
            </Link>
          ) : (
            (value ?? "—")
          )}
        </p>
        <p className="mt-1.5 text-meta text-muted">{note}</p>
      </dd>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="page" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-16 w-[min(36rem,90%)]" />
      <Skeleton className="mt-8 h-11 w-48 rounded-full" />
      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <Skeleton className="aspect-square w-full rounded-full" />
      </div>
    </div>
  );
}
