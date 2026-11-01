"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Eye } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchRing } from "@/components/title/MatchRing";
import { PosterCard } from "@/components/title/PosterCard";
import { RelationActions } from "@/components/social/RelationActions";
import { useProfile } from "@/lib/api/social";
import { ApiClientError } from "@/lib/api/client";
import { cardMeta } from "@/lib/catalog/cards";
import { tmdbImg } from "@/lib/images/tmdb";
import { ease } from "@/lib/motion";
import type { ProfileTitle, ProfileView as Profile } from "@/lib/social/profile";

const SEES = { everything: "everything: library, ratings, watchlist and activity", ratings: "your ratings only", nothing: "nothing beyond this card" } as const;
const STATUS = { watched: "Watched", watching: "Watching", dropped: "Dropped" } as const;

/** /u/[handle]: the public card for everyone signed in; for friends, what the owner shares. */
export function ProfileView({ handle }: { handle: string }) {
  return (
    <AuthGuard fallback={<ProfileSkeleton />}>
      <ProfileBody handle={handle} />
    </AuthGuard>
  );
}

function ProfileBody({ handle }: { handle: string }) {
  const { data, error, refetch } = useProfile(handle);
  if (error && !data) {
    const missing = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="page pt-[calc(var(--nav-h)+5rem)] pb-[var(--section-y)]">
        <p className="font-display text-h2">{missing ? "No one here by that name." : "This profile didn’t load."}</p>
        <p className="mt-4 max-w-[44ch] text-muted">{missing ? "The handle may have changed, or the account isn’t available." : "Check your connection and try again."}</p>
        <div className="mt-8 flex gap-3">
          {missing ? null : <Button onClick={() => void refetch()}>Try again</Button>}
          <Button asChild variant="secondary">
            <Link href="/friends">Go to Friends</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!data) return <ProfileSkeleton />;
  return <Profile p={data} />;
}

function Profile({ p }: { p: Profile }) {
  const reduced = useReducedMotion();
  const self = p.relation === "self";
  const first = p.person.name.split(" ")[0];
  const shelf = p.library ?? p.ratings;
  const status = p.relation === "request-sent" ? "Request sent" : p.relation === "request-received" ? `${first} wants to be friends` : null;

  return (
    <article className="pb-[var(--section-y)] pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+4.5rem)]">
      <header className="page grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="flex flex-wrap items-end gap-6 md:gap-8">
          <motion.span initial={reduced ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: ease.out }}>
            <Avatar name={p.person.name} photoURL={p.person.photoURL} avatar={p.person.avatar} size={112} />
          </motion.span>
          <div className="min-w-0">
            {p.person.handle ? <p className="text-meta text-muted">@{p.person.handle}</p> : null}
            <h1 className="mt-2 max-w-[14ch] text-h1">{p.person.name}</h1>
            {status ? <p className="mt-3 text-meta text-muted">{status}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {p.match != null ? <MatchRing value={p.match} label="taste match" className="w-[8.5rem]" /> : null}
          {p.relation === "friends" && p.person.handle ? (
            <Button asChild variant="secondary">
              <Link href={`/u/${p.person.handle}/compare`}>Compare tastes</Link>
            </Button>
          ) : null}
          <RelationActions person={p.person} relation={p.relation} friendshipId={p.friendshipId} via="profile" size="md" />
        </div>
      </header>

      {self ? (
        <div className="page mt-10">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-panel)] border border-hairline bg-surface px-5 py-4 text-meta text-muted">
            <Eye size={16} weight="light" aria-hidden="true" className="text-text" />
            This is what your friends see. They can see {SEES[p.friendsSee ?? "ratings"]}. Titles you hide never appear.
            <Link href="/settings#privacy" className="link-draw text-text">
              Change in Settings
            </Link>
          </p>
        </div>
      ) : null}

      <section aria-labelledby="dna" className="page mt-14 md:mt-20">
        <h2 id="dna" className="caption font-sans">
          {self ? "Your Taste DNA" : `${first}’s Taste DNA`}
        </h2>
        {p.dna.length ? (
          <ul className="mt-4 max-w-4xl border-t border-hairline">
            {p.dna.map((phrase, i) => (
              <li key={phrase} className="overflow-hidden border-b border-hairline py-3">
                <motion.span
                  className="block font-display text-[clamp(1.75rem,3.4vw,2.625rem)] leading-[1.08]"
                  initial={reduced ? false : { y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, ease: ease.out, delay: 0.15 + i * 0.1 }}
                >
                  {phrase}
                </motion.span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-hairline pt-4 text-muted">{self ? "Rate a few titles and yours will appear here." : `${first} is still building theirs.`}</p>
        )}
      </section>

      {shelf ? (
        <Shelf id="shelf" title={p.library ? (self ? "Your library, as friends see it" : `${first}’s library`) : self ? "Your ratings, as friends see them" : `${first}’s ratings`} items={shelf} />
      ) : null}
      {p.watchlist ? <Shelf id="watchlist" title={self ? "Your watchlist, as friends see it" : `${first}’s watchlist`} items={p.watchlist} /> : null}

      {!self && p.relation !== "friends" ? (
        <p className="page mt-14 max-w-[52ch] text-muted md:mt-20">Become friends to see what {first} shares: ratings, and more if they allow it.</p>
      ) : null}
      {!self && p.relation === "friends" && !p.scopes.length ? (
        <p className="page mt-14 max-w-[52ch] text-muted md:mt-20">{first} keeps their library to themselves. Your taste match still works.</p>
      ) : null}
    </article>
  );
}

function Shelf({ id, title, items }: { id: string; title: string; items: ProfileTitle[] }) {
  return (
    <section aria-labelledby={id} className="page mt-14 md:mt-20">
      <h2 id={id} className="flex items-baseline gap-3 font-display text-h3">
        {title}
        <span className="numeral text-[0.875rem] text-muted">{items.length}</span>
      </h2>
      {items.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-[var(--gutter)] gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
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
                meta={t.rating ? `★ ${t.rating / 2}` : t.status ? (STATUS[t.status as keyof typeof STATUS] ?? cardMeta(t.card)) : cardMeta(t.card)}
                sizes="(min-width: 1280px) 13vw, (min-width: 1024px) 17vw, (min-width: 640px) 28vw, 44vw"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-hairline pt-4 text-muted">Nothing here yet.</p>
      )}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className="page pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+4.5rem)]">
      <div className="flex items-end gap-8">
        <Skeleton className="size-28 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-72" />
        </div>
      </div>
      <Skeleton className="mt-16 h-48 w-full max-w-4xl" />
    </div>
  );
}
