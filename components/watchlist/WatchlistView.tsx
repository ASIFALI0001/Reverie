"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { RatingInput } from "@/components/ui/RatingInput";
import { MatchBadge } from "@/components/title/MatchRing";
import { LibrarySheet, preloadLibrarySheet } from "@/components/ui/LazyDialogs";
import type { SheetTitle } from "@/components/library/LibrarySheet";
import { EyeSlash } from "@phosphor-icons/react";
import { useSaveToLibrary, useSetWatchlistHidden, useToggleWatchlist, useWatchlist } from "@/lib/api/library";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/client";
import { flyToNav } from "@/lib/fx/fly";
import { toast } from "@/lib/store/toast";
import { tmdbImg, tmdbImgUrl } from "@/lib/images/tmdb";
import { cardMeta } from "@/lib/catalog/cards";
import { ease, spring } from "@/lib/motion";
import type { WatchlistEntry } from "@/lib/library/service";

type SortKey = "match" | "added" | "runtime" | "streaming";
const SORT_LABEL: Record<SortKey, string> = {
  match: "Your match",
  added: "Recently added",
  runtime: "Shortest first",
  streaming: "Streaming now",
};

export function WatchlistView() {
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <AuthGuard fallback={<ListSkeleton />}>
        <WatchlistBody />
      </AuthGuard>
    </div>
  );
}

function WatchlistBody() {
  const { status } = useAuth();
  const watchlist = useWatchlist();
  const [sort, setSort] = useState<SortKey>("match");
  // After "Mark watched": what worked, what didn't. Kept mounted once used, so closing animates.
  const [review, setReview] = useState<{ title: SheetTitle; open: boolean } | null>(null);
  const availability = useQuery({
    queryKey: ["watchlist", "availability"],
    queryFn: () => api<{ region: string; streaming: Record<string, string[]> }>("/api/watchlist/availability"),
    enabled: status === "signed-in" && (watchlist.data?.items.length ?? 0) > 0,
    staleTime: 30 * 60_000,
  });

  const items = useMemo(() => {
    const list = [...(watchlist.data?.items ?? [])];
    const streaming = availability.data?.streaming ?? {};
    const hasMatches = list.some((i) => i.match != null);
    const by: Record<SortKey, (a: WatchlistEntry, b: WatchlistEntry) => number> = {
      match: hasMatches ? (a, b) => (b.match ?? -1) - (a.match ?? -1) : (a, b) => b.addedAt.localeCompare(a.addedAt),
      added: (a, b) => b.addedAt.localeCompare(a.addedAt),
      runtime: (a, b) => (a.card.runtime ?? 9999) - (b.card.runtime ?? 9999),
      streaming: (a, b) => Number((streaming[b.key]?.length ?? 0) > 0) - Number((streaming[a.key]?.length ?? 0) > 0),
    };
    return list.sort(by[sort]);
  }, [watchlist.data, availability.data, sort]);

  const hasMatches = items.some((i) => i.match != null);

  return (
    <>
      <header className="grid-editorial items-end gap-y-6">
        <div className="col-span-12 md:col-span-8">
          <h1 className="text-h1">Your watchlist</h1>
          <p className="mt-5 max-w-[44ch] text-muted">
            {hasMatches ? "Ranked by how much you’ll like each one." : "Everything you’ve saved for later. Rate a few titles and Reverie will rank this list for you."}
          </p>
        </div>
        <label className="col-span-12 flex items-center gap-3 text-meta text-muted md:col-span-4 md:justify-end">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 cursor-pointer rounded-full border border-hairline-strong bg-transparent px-4 text-[0.9375rem] text-text outline-none"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k} className="bg-surface">
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="mt-12">
        {watchlist.isLoading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <div className="border-t border-hairline py-20 text-center">
            <p className="mx-auto max-w-[24ch] font-display text-h3">Nothing saved for later yet.</p>
            <p className="mx-auto mt-4 max-w-[40ch] text-muted">Tap the bookmark on any title and it lands here, ranked by how much you’ll like it.</p>
            <Button asChild className="mt-8">
              <Link href="/search">Find something to watch</Link>
            </Button>
          </div>
        ) : (
          <ol className="border-t border-hairline">
            <AnimatePresence initial={false}>
              {items.map((item, i) => (
                <WatchRow
                  key={item.key}
                  item={item}
                  rank={i + 1}
                  streaming={availability.data?.streaming[item.key] ?? null}
                  onWatched={(title) => setReview({ title, open: true })}
                />
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>
      {review ? (
        <LibrarySheet
          mode="review"
          open={review.open}
          onOpenChange={(open) => setReview((r) => r && { ...r, open })}
          title={review.title}
        />
      ) : null}
    </>
  );
}

/**
 * One ranked row. "Mark watched" flips it like a departures board to ask for a rating;
 * once saved, the list asks what worked and what didn't.
 */
function WatchRow({
  item,
  rank,
  streaming,
  onWatched,
}: {
  item: WatchlistEntry;
  rank: number;
  streaming: string[] | null;
  onWatched: (title: SheetTitle) => void;
}) {
  const save = useSaveToLibrary();
  const toggle = useToggleWatchlist();
  const setHidden = useSetWatchlistHidden();
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const c = item.card;

  async function markWatched() {
    try {
      const rect = posterRef.current?.getBoundingClientRect() ?? null;
      await save.mutateAsync({ mediaType: c.mediaType, tmdbId: c.tmdbId, status: "watched", rating });
      void flyToNav(rect, tmdbImgUrl(c.posterPath, "w185"), "library");
      // Let the poster land, then ask what worked (the sheet confirms the move, so no toast).
      window.setTimeout(() => onWatched({ mediaType: c.mediaType, tmdbId: c.tmdbId, title: c.title }), 750);
    } catch (err) {
      toast({ title: "Couldn’t save that", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  async function removeIt() {
    try {
      await toggle.mutateAsync({ mediaType: c.mediaType, tmdbId: c.tmdbId, on: false });
      toast({ title: `Removed ${c.title}`, action: { label: "Undo", onClick: () => toggle.mutate({ mediaType: c.mediaType, tmdbId: c.tmdbId, on: true }) } });
    } catch (err) {
      toast({ title: "Couldn’t remove that", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.35, ease: ease.inOut } }}
      transition={spring.soft}
      className="border-b border-hairline [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateX: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: ease.out }}
        className="relative grid [transform-style:preserve-3d]"
      >
        {/* Front: the ranked row. */}
        <div className="col-start-1 row-start-1 grid grid-cols-[2.25rem_4rem_minmax(0,1fr)] items-center gap-x-4 py-5 [backface-visibility:hidden] sm:grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_auto] sm:gap-x-6">
          <span className="numeral text-[1.5rem] font-extralight text-muted sm:text-[2rem]">{String(rank).padStart(2, "0")}</span>
          <div ref={posterRef} className="relative aspect-[2/3] overflow-hidden rounded-[2px] bg-surface">
            {c.posterPath ? <Image src={tmdbImg(c.posterPath)!} alt="" fill sizes="72px" className="object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <Link href={c.href} className="link-draw font-display text-h4 leading-tight">
              {c.title}
            </Link>
            <p className="mt-1.5 truncate text-meta text-muted [font-variant-numeric:tabular-nums]">
              {[c.year, cardMeta(c), c.genres.slice(0, 2).join(", ")].filter(Boolean).join("  ·  ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {item.match != null ? <MatchBadge value={item.match} /> : null}
              {streaming === null ? null : streaming.length ? (
                <span className="text-meta text-text/80">On {streaming.join(", ")}</span>
              ) : (
                <span className="text-meta text-muted">Not streaming in your region</span>
              )}
              {item.hiddenFromFriends ? (
                <span className="inline-flex items-center gap-1.5 text-meta text-muted">
                  <EyeSlash size={14} weight="light" aria-hidden="true" /> Hidden from friends
                </span>
              ) : null}
            </div>
          </div>
          <div className="col-span-3 mt-4 flex gap-2 sm:col-span-1 sm:mt-0">
            <Button size="sm" variant="secondary" onPointerEnter={preloadLibrarySheet} onFocus={preloadLibrarySheet} onClick={() => setFlipped(true)}>
              Mark watched
            </Button>
            <Button size="sm" variant="ghost" onClick={removeIt}>
              Remove
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={item.hiddenFromFriends}
              aria-label={item.hiddenFromFriends ? `Show ${c.title} to friends` : `Hide ${c.title} from friends`}
              title={item.hiddenFromFriends ? "Show to friends" : "Hide from friends"}
              pending={setHidden.isPending}
              className="px-3"
              onClick={() =>
                setHidden.mutate(
                  { mediaType: c.mediaType, tmdbId: c.tmdbId, hidden: !item.hiddenFromFriends },
                  {
                    onSuccess: ({ hiddenFromFriends }) => toast({ title: hiddenFromFriends ? `${c.title} is hidden from friends` : `Friends can see ${c.title} again` }),
                    onError: (err) => toast({ title: "Couldn’t change that", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                  },
                )
              }
            >
              <EyeSlash size={18} weight={item.hiddenFromFriends ? "fill" : "light"} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Back: how was it? */}
        <div
          // inert, not aria-hidden: the hidden face must also leave the tab order.
          inert={!flipped}
          className="col-start-1 row-start-1 flex flex-wrap items-center gap-x-8 gap-y-4 py-5 [backface-visibility:hidden] [transform:rotateX(180deg)]"
        >
          <p className="font-display text-h4">How was {c.title}?</p>
          <RatingInput value={rating} onChange={setRating} size={28} />
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFlipped(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={markWatched} pending={save.isPending}>
              {rating ? "Save to library" : "Save without rating"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

function ListSkeleton() {
  return (
    <div className="border-t border-hairline" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="grid grid-cols-[3.5rem_4.5rem_1fr] items-center gap-6 border-b border-hairline py-5">
          <Skeleton className="h-8 w-10" />
          <Skeleton className="aspect-[2/3] w-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
