"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, HandWaving, UserPlus } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { RiseHeading } from "@/components/motion/RiseHeading";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchMini } from "@/components/title/MatchRing";
import { useConnectTwin, useTwins, type TwinView, type TwinsView as Twins } from "@/lib/api/twins";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { ease, spring } from "@/lib/motion";

export function TwinsView() {
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <p className="caption text-muted">
        <Link href="/taste" className="link-draw">
          Your taste
        </Link>
      </p>
      <RiseHeading className="mt-3 max-w-[14ch] text-h1">Your Taste Twins</RiseHeading>
      <p className="mt-5 max-w-[56ch] text-[1.0625rem] text-muted">
        The people whose taste is closest to yours, out of everyone on Reverie. Anonymous until you both tap Connect; then you’re friends.
      </p>
      <AuthGuard fallback={<TwinsSkeleton />}>
        <Body />
      </AuthGuard>
    </div>
  );
}

function Body() {
  const twins = useTwins();
  if (twins.isPending) return <TwinsSkeleton />;
  if (twins.isError) {
    return (
      <div className="mt-12 max-w-xl">
        <p className="font-display text-h3">Your twins didn’t load.</p>
        <Button className="mt-6" onClick={() => twins.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const v = twins.data;
  if (!v.eligible) return <NotYet v={v} />;
  if (!v.twins.length) {
    return (
      <div className="mt-12 max-w-[56ch] border-t border-hairline pt-8">
        <p className="font-display text-h3">No twins yet.</p>
        <p className="mt-3 text-muted">Nobody’s taste is close enough to yours right now. We look again every time your taste changes, and as more people join.</p>
      </div>
    );
  }
  return (
    <>
      <ol className="mt-12 grid grid-cols-1 gap-x-[var(--gutter)] gap-y-10 border-t border-hairline pt-10 md:grid-cols-2 xl:grid-cols-3">
        {v.twins.map((t, i) => (
          <TwinCard key={t.token} twin={t} index={i} />
        ))}
      </ol>
      <p className="mt-14 max-w-[64ch] text-meta text-muted">
        Your twins see the same about you: a codename, how close your tastes are, the genres you share and titles you both loved. Titles you hide from friends never count.{" "}
        <Link href="/settings#privacy" className="link-draw text-text">
          Leave Taste Twins
        </Link>{" "}
        any time.
      </p>
    </>
  );
}

function TwinCard({ twin: t, index }: { twin: TwinView; index: number }) {
  const reduced = useReducedMotion();
  const connect = useConnectTwin();
  const [h1, h2] = t.hues;
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: ease.out, delay: Math.min(index, 8) * 0.06 }}
      className="flex flex-col"
    >
      <div className="flex items-center gap-4">
        <AnimatePresence mode="wait" initial={false}>
          {t.friend ? (
            <motion.span key="friend" initial={reduced ? false : { rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={spring.soft}>
              <Avatar name={t.friend.name} photoURL={t.friend.photoURL} avatar={t.friend.avatar} size={64} />
            </motion.span>
          ) : (
            <motion.span
              key="twin"
              aria-hidden="true"
              exit={reduced ? undefined : { rotateY: -90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="block size-16 shrink-0 rounded-full"
              style={{ background: `radial-gradient(circle at 30% 28%, oklch(0.8 0.11 ${h1}), oklch(0.5 0.13 ${h2}) 72%)` }}
            />
          )}
        </AnimatePresence>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-h3 leading-none">{t.friend ? t.friend.name : `Twin #${t.codename}`}</h2>
          <p className="mt-1.5 text-meta text-muted">{t.friend ? (t.friend.handle ? `@${t.friend.handle} · met as Twin #${t.codename}` : `Met as Twin #${t.codename}`) : "Anonymous until you both connect"}</p>
        </div>
        <MatchMini value={t.score} label="taste match" />
      </div>

      {t.sharedGenres.length ? (
        <p className="mt-5 text-meta text-muted">
          You both lean toward{" "}
          {/* Each separator stays with the genre before it, so a line never starts with one. */}
          {t.sharedGenres.map((g, i) => (
            <span key={g} className="text-text">
              <span className="whitespace-nowrap">
                {g}
                {i < t.sharedGenres.length - 1 ? " ·" : ""}
              </span>{" "}
            </span>
          ))}
        </p>
      ) : null}

      {t.sharedLoved.length ? (
        <div className="mt-6">
          <p className="text-meta text-muted">You both loved</p>
          <ul className="mt-3 flex gap-3">
            {t.sharedLoved.map((c) => (
              <li key={c.key}>
                <Link href={c.href} className="group relative block aspect-[2/3] w-[4.5rem] overflow-hidden rounded-[2px] bg-surface">
                  {c.posterPath ? <Image src={tmdbImg(c.posterPath, "thumb")!} alt={c.title} fill sizes="72px" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 text-meta text-muted">No titles you’ve both rated highly yet; the match is from your tastes overall.</p>
      )}

      <div className="mt-6">
        {t.state === "friends" ? (
          t.friend?.handle ? (
            <Button asChild variant="secondary">
              <Link href={`/u/${t.friend.handle}`}>Friends now: see their profile</Link>
            </Button>
          ) : (
            <p className="text-meta text-text">You’re friends now.</p>
          )
        ) : t.state === "sent" ? (
          <p className="inline-flex h-11 items-center gap-2 text-meta text-muted">
            <Check size={16} weight="bold" aria-hidden="true" /> Waiting for them to connect too
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={t.state === "received" ? "primary" : "secondary"}
              pending={connect.isPending}
              onClick={() =>
                connect.mutate(t.token, {
                  onSuccess: (r) =>
                    toast({ title: r.state === "friends" ? `You and ${r.friend?.name ?? "your twin"} are friends now` : "Sent. If they connect too, you’ll be friends." }),
                  onError: (err) => toast({ title: "Couldn’t connect", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                })
              }
            >
              {t.state === "received" ? <HandWaving size={18} weight="light" aria-hidden="true" /> : <UserPlus size={18} weight="light" aria-hidden="true" />}
              {t.state === "received" ? "Connect back" : "Connect"}
            </Button>
            {t.state === "received" ? <span className="text-meta text-muted">They’d like to connect</span> : null}
          </div>
        )}
      </div>
    </motion.li>
  );
}

function NotYet({ v }: { v: Twins }) {
  if (v.reason === "opted-out") {
    return (
      <div className="mt-12 max-w-[56ch] border-t border-hairline pt-8">
        <p className="font-display text-h3">You’re not in Taste Twins.</p>
        <p className="mt-3 text-muted">You chose to stay out, so nobody is matched with you and you aren’t matched with anyone.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/settings#privacy">Join in Settings</Link>
        </Button>
      </div>
    );
  }
  const left = Math.max(0, v.minSignals - v.signals);
  return (
    <div className="mt-12 max-w-[56ch] border-t border-hairline pt-8">
      <p className="font-display text-h3">Rate {left} more title{left === 1 ? "" : "s"} to meet your twins.</p>
      <p className="mt-3 text-muted">Twins are matched on taste, and it takes about {v.minSignals} titles for yours to show.</p>
      <div className="mt-5 h-[3px] max-w-sm overflow-hidden rounded-full bg-text/15" role="progressbar" aria-label="Titles so far" aria-valuemin={0} aria-valuemax={v.minSignals} aria-valuenow={v.signals}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (v.signals / v.minSignals) * 100)}%` }} />
      </div>
      <Button asChild className="mt-6">
        <Link href="/library">Rate what you’ve watched</Link>
      </Button>
    </div>
  );
}

function TwinsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-12 grid grid-cols-1 gap-10 border-t border-hairline pt-10 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="mt-6 flex gap-3">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="aspect-[2/3] w-[4.5rem]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
