"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookmarkSimple, Check, Eye, X } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { RatingInput } from "@/components/ui/RatingInput";
import { MatchBadge } from "@/components/title/MatchRing";
import { useReactToRecommendation, type InboxItem } from "@/lib/api/social";
import { tmdbImg } from "@/lib/images/tmdb";
import { timeAgo } from "@/lib/format";
import { toast } from "@/lib/store/toast";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";

const REPLIED = {
  watchlisted: "On your watchlist",
  watched: "You watched it",
  "not-for-me": "Not for you",
} as const;

/**
 * One title a friend sent: who, their note, your own match, and a one-tap reply
 * ("Add to watchlist", "Watched it — 8/10", "Not for me"). The sender hears back.
 */
export function SentCard({ item, className }: { item: InboxItem; className?: string }) {
  const react = useReactToRecommendation();
  const reduced = useReducedMotion();
  const [rating, setRating] = useState<number | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const first = item.from.name.split(" ")[0];
  const c = item.card;

  function reply(kind: "watchlisted" | "watched" | "not-for-me", r?: number | null) {
    react.mutate(
      { id: item.id, kind, rating: r ?? null },
      {
        onSuccess: () => toast({ title: kind === "not-for-me" ? `Told ${first} it’s not for you` : `${first} will see your reply` }),
        onError: (err) => toast({ title: "Couldn’t send your reply", description: err instanceof Error ? err.message : undefined, tone: "error" }),
      },
    );
  }

  return (
    <article className={cn("flex h-full flex-col rounded-[var(--radius-panel)] border border-hairline bg-surface p-4", !item.reaction && !item.seen && "border-accent/40", className)}>
      <header className="flex items-center gap-2.5">
        <Avatar name={item.from.name} photoURL={item.from.photoURL} avatar={item.from.avatar} size={26} />
        <p className="min-w-0 flex-1 truncate text-meta">
          {item.from.handle ? (
            <Link href={`/u/${item.from.handle}`} className="text-text hover:underline">
              {item.from.name}
            </Link>
          ) : (
            <span className="text-text">{item.from.name}</span>
          )}{" "}
          <span className="text-muted">sent you this · {timeAgo(item.at)}</span>
        </p>
      </header>

      <div className="mt-3 flex gap-4">
        <Link href={c.href} tabIndex={-1} aria-hidden="true" className="relative aspect-[2/3] w-[4.5rem] shrink-0 overflow-hidden rounded-[2px] bg-raised">
          {c.posterPath ? <Image src={tmdbImg(c.posterPath, "thumb")!} alt="" fill sizes="72px" className="object-cover" /> : null}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={c.href} className="link-draw font-display text-[1.375rem] leading-tight">
            {c.title}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted">
            {c.year ?? ""}
            {item.match != null ? <MatchBadge value={item.match} className="bg-text/[0.06]" /> : null}
          </p>
          {item.note ? <p className="mt-2 line-clamp-3 font-display text-[1.0625rem] italic leading-snug text-text/90">“{item.note}”</p> : null}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <AnimatePresence mode="wait" initial={false}>
          {item.reaction ? (
            <motion.p
              key="done"
              className="flex items-center gap-2 text-meta text-muted"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: ease.out }}
            >
              <Check size={14} weight="bold" className="text-accent" aria-hidden="true" />
              {REPLIED[item.reaction.kind]}
              {item.reaction.kind === "watched" && item.reaction.rating ? ` · ${item.reaction.rating}/10` : ""}
            </motion.p>
          ) : rateOpen ? (
            <motion.div key="rate" className="flex flex-wrap items-center gap-3" initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <RatingInput value={rating} onChange={setRating} size={22} label={`Your rating for ${c.title}`} />
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setRateOpen(false)}>
                  Back
                </Button>
                <Button size="sm" pending={react.isPending} onClick={() => reply("watched", rating)}>
                  {rating ? `Send ${rating}/10` : "Send without rating"}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="ask" className="flex flex-wrap gap-1.5" initial={false} exit={reduced ? undefined : { opacity: 0 }}>
              <Button size="sm" variant="secondary" pending={react.isPending && react.variables?.kind === "watchlisted"} onClick={() => reply("watchlisted")}>
                <BookmarkSimple size={15} weight="light" aria-hidden="true" /> Add to watchlist
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRateOpen(true)}>
                <Eye size={15} weight="light" aria-hidden="true" /> Watched it
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Not for me: ${c.title}`} pending={react.isPending && react.variables?.kind === "not-for-me"} onClick={() => reply("not-for-me")}>
                <X size={15} weight="light" aria-hidden="true" /> Not for me
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
