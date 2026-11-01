"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchRing } from "@/components/title/MatchRing";
import { PosterCard } from "@/components/title/PosterCard";
import { AvatarsSnap } from "@/components/social/AvatarsSnap";
import { CompareRadar } from "@/components/social/CompareRadar";
import { useCompare, useProfile, type CompareView as Compare } from "@/lib/api/social";
import { ApiClientError } from "@/lib/api/client";
import { tmdbImg } from "@/lib/images/tmdb";
import type { CompareTitle } from "@/lib/social/compare";

/** /u/[handle]/compare: two friends side by side. */
export function CompareView({ handle }: { handle: string }) {
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+4.5rem)]">
      <AuthGuard fallback={<CompareSkeleton />}>
        <CompareBody handle={handle} />
      </AuthGuard>
    </div>
  );
}

function CompareBody({ handle }: { handle: string }) {
  const profile = useProfile(handle);
  const uid = profile.data?.relation === "friends" ? profile.data.person.uid : null;
  const compare = useCompare(uid ?? "");
  if (profile.data && profile.data.relation !== "friends") {
    return (
      <div className="max-w-xl">
        <p className="font-display text-h2">Comparing tastes is for friends.</p>
        <p className="mt-4 text-muted">Once you and {profile.data.person.name.split(" ")[0]} are friends, you’ll see where your tastes agree and clash.</p>
        <Button asChild className="mt-8">
          <Link href={`/u/${handle}`}>See their profile</Link>
        </Button>
      </div>
    );
  }
  const error = profile.error ?? compare.error;
  if (error && !compare.data) {
    const missing = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="max-w-xl">
        <p className="font-display text-h2">{missing ? "No one here by that name." : "This didn’t load."}</p>
        <Button asChild variant="secondary" className="mt-8">
          <Link href="/friends">Back to Friends</Link>
        </Button>
      </div>
    );
  }
  if (!uid || !compare.data) return <CompareSkeleton />;
  return <Comparison c={compare.data} handle={handle} />;
}

function Comparison({ c, handle }: { c: Compare; handle: string }) {
  const first = c.them.name.split(" ")[0]!;
  return (
    <>
      <p className="text-meta text-muted">
        <Link href={`/u/${handle}`} className="link-draw">
          {c.them.name}
        </Link>{" "}
        / Compare
      </p>
      <header className="mt-6 grid grid-cols-1 items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <AvatarsSnap a={c.me} b={c.them} size={64} />
          <h1 className="mt-6 max-w-[16ch] text-h1">You and {first}</h1>
          <p className="mt-3 max-w-[48ch] text-muted">From the taste each of you shares with friends: hidden titles never count.</p>
        </div>
        {c.match != null ? <MatchRing value={c.match} label="taste match" className="w-[9.5rem]" /> : null}
      </header>

      <section className="mt-14 grid grid-cols-1 gap-12 md:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <CompareRadar mine={c.radars.mine} theirs={c.radars.theirs} theirName={first} className="mx-auto max-w-[26rem]" />
        <div className="space-y-12">
          <Lines title="Where you agree" lines={c.agree.map((a) => a.line)} empty={`No strong shared pulls yet. Rate a few more titles, both of you, and they’ll show.`} />
          <Lines title="Where you clash" lines={c.clash.map((a) => a.line)} empty="No real clashes: your tastes pull the same way, or not strongly enough to say." />
        </div>
      </section>

      {c.titles ? (
        <>
          <Titles id="both-loved" title="You both loved" items={c.titles.bothLoved} first={first} empty="Nothing you’ve both rated 8 or more yet." />
          <Titles id="they-loved" title={`${first} loved, you haven’t seen`} items={c.titles.theyLoved} first={first} empty={`Nothing new from ${first}’s favourites.`} />
          {c.titles.splitOn.length ? <Splits items={c.titles.splitOn} first={first} /> : null}
        </>
      ) : (
        <p className="mt-14 max-w-[56ch] border-t border-hairline pt-5 text-muted md:mt-20">
          {first} doesn’t share ratings with friends, so this compares your tastes only.
        </p>
      )}
    </>
  );
}

function Lines({ title, lines, empty }: { title: string; lines: string[]; empty: string }) {
  return (
    <div>
      <h2 className="caption font-sans">{title}</h2>
      {lines.length ? (
        <ul className="mt-3 border-t border-hairline">
          {lines.map((l) => (
            <li key={l} className="border-b border-hairline py-3 font-display text-[clamp(1.375rem,2.2vw,1.75rem)] leading-tight">
              {l}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-hairline pt-3 text-muted">{empty}</p>
      )}
    </div>
  );
}

function Titles({ id, title, items, first, empty }: { id: string; title: string; items: CompareTitle[]; first: string; empty: string }) {
  return (
    <section aria-labelledby={id} className="mt-14 md:mt-20">
      <h2 id={id} className="font-display text-h3">
        {title}
      </h2>
      {items.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-[var(--gutter)] gap-y-10 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {items.map((t) => (
            <li key={t.card.key}>
              <PosterCard
                href={t.card.href}
                title={t.card.title}
                titleKey={t.card.key}
                posterPath={t.card.posterPath}
                posterSrc={tmdbImg(t.card.posterPath) ?? ""}
                blur={t.card.posterBlur}
                color={t.card.color ?? undefined}
                year={t.card.year}
                meta={t.mine != null ? `You ${t.mine} · ${first} ${t.theirs}` : `${first} ${t.theirs}/10`}
                sizes="(min-width: 1280px) 11vw, (min-width: 1024px) 15vw, (min-width: 640px) 22vw, 44vw"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-hairline pt-4 text-muted">{empty}</p>
      )}
    </section>
  );
}

function Splits({ items, first }: { items: CompareTitle[]; first: string }) {
  return (
    <section aria-labelledby="split-on" className="mt-14 md:mt-20">
      <h2 id="split-on" className="font-display text-h3">
        Where you split
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-x-10 border-t border-hairline md:grid-cols-2">
        {items.map((t) => (
          <li key={t.card.key} className="flex items-center justify-between gap-4 border-b border-hairline py-3">
            <Link href={t.card.href} className="min-w-0 truncate text-[1.0625rem] hover:underline">
              {t.card.title}
            </Link>
            <span className="shrink-0 text-meta text-muted tabular-nums">
              You {t.mine}/10 · {first} {t.theirs}/10
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompareSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-16 w-40 rounded-full" />
      <Skeleton className="mt-6 h-20 w-80" />
      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full max-w-[26rem]" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
