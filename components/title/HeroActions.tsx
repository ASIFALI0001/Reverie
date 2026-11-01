"use client";

import { useQuery } from "@tanstack/react-query";
import { BookmarkSimple, Check, PaperPlaneTilt, Plus, Signpost } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { DeferredLink } from "@/components/ui/DeferredLink";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  LibrarySheet,
  SendToFriendSheet,
  ShouldContinueSheet,
  preloadContinueSheet,
  preloadLibrarySheet,
  preloadSendSheet,
} from "@/components/ui/LazyDialogs";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOpenOnce } from "@/lib/hooks/use-open-once";
import { libraryKeys, useTitleState, useToggleWatchlist } from "@/lib/api/library";
import { api } from "@/lib/api/client";
import { flyToNav } from "@/lib/fx/fly";
import { toast } from "@/lib/store/toast";
import { tmdbImgUrl } from "@/lib/images/tmdb";
import type { LibraryEntry } from "@/lib/library/service";
import type { MediaType, TitleKey } from "@/lib/catalog/types";

const STATUS_LABEL = { watched: "Watched", watching: "Watching", dropped: "Dropped" } as const;

type Props = {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  path: string;
  /** Series pages offer "Should I keep going?" (Home's Tonight pick doesn't: you haven't started it). */
  askContinue?: boolean;
};

export function HeroActions({ mediaType, tmdbId, title, posterPath, path, askContinue = false }: Props) {
  const { status } = useAuth();
  const key = `${mediaType}:${tmdbId}` as TitleKey;
  const state = useTitleState([key]);
  const toggle = useToggleWatchlist();
  const [open, setOpen, sheetMounted] = useOpenOnce();
  const [sending, setSending, sendMounted] = useOpenOnce();
  const [asking, setAsking, askMounted] = useOpenOnce();
  const s = state.data?.[key];
  const inLibrary = s?.library ?? null;
  const offerContinue = askContinue && mediaType === "tv" && inLibrary?.status !== "watched";

  // The full entry (note, date, shelves) is only needed when editing.
  const entry = useQuery({
    queryKey: [...libraryKeys.all, "entry", key],
    queryFn: async () => (await api<{ items: LibraryEntry[] }>(`/api/library?key=${key}`)).items[0] ?? null,
    enabled: open && inLibrary !== null,
  });

  const posterRect = () => document.querySelector(`[data-hero-poster="${key}"]`)?.getBoundingClientRect() ?? null;
  const posterUrl = tmdbImgUrl(posterPath, "w185");

  if (status === "signed-out") {
    const href = `/signin?next=${encodeURIComponent(path)}`;
    return (
      <>
        <Button asChild>
          <DeferredLink href={href}>
            <Plus size={18} weight="light" aria-hidden="true" /> Add to library
          </DeferredLink>
        </Button>
        <Button asChild variant="secondary">
          <DeferredLink href={href}>
            <BookmarkSimple size={18} weight="light" aria-hidden="true" /> Watchlist
          </DeferredLink>
        </Button>
      </>
    );
  }
  if (status === "loading" || state.isLoading) {
    return (
      <>
        <Skeleton className="h-11 w-40 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </>
    );
  }

  async function toggleWatchlist() {
    const on = !s?.watchlist;
    try {
      await toggle.mutateAsync({ mediaType, tmdbId, on });
      if (on) {
        void flyToNav(posterRect(), posterUrl, "watchlist");
        toast({
          title: `Added ${title} to your watchlist`,
          action: { label: "Undo", onClick: () => toggle.mutate({ mediaType, tmdbId, on: false }) },
        });
      } else {
        toast({ title: `Removed ${title} from your watchlist` });
      }
    } catch (err) {
      toast({ title: "Couldn’t update your watchlist", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  return (
    <>
      {inLibrary ? (
        <Button variant="secondary" onPointerEnter={preloadLibrarySheet} onFocus={preloadLibrarySheet} onClick={() => setOpen(true)}>
          <Check size={18} weight="light" aria-hidden="true" />
          {STATUS_LABEL[inLibrary.status]}
          {inLibrary.rating ? <span className="numeral text-muted">· ★{inLibrary.rating / 2}</span> : null}
        </Button>
      ) : (
        <Button onPointerEnter={preloadLibrarySheet} onFocus={preloadLibrarySheet} onClick={() => setOpen(true)}>
          <Plus size={18} weight="light" aria-hidden="true" /> Add to library
        </Button>
      )}
      {!inLibrary ? (
        <Button variant="secondary" aria-pressed={s?.watchlist ?? false} onClick={toggleWatchlist} pending={toggle.isPending}>
          <BookmarkSimple size={18} weight={s?.watchlist ? "fill" : "light"} className={s?.watchlist ? "text-[var(--tint)]" : undefined} aria-hidden="true" />
          {s?.watchlist ? "On your watchlist" : "Watchlist"}
        </Button>
      ) : null}
      <Button variant="ghost" onPointerEnter={preloadSendSheet} onFocus={preloadSendSheet} onClick={() => setSending(true)}>
        <PaperPlaneTilt size={18} weight="light" aria-hidden="true" /> Send to a friend
      </Button>
      {offerContinue ? (
        <Button variant="ghost" onPointerEnter={preloadContinueSheet} onFocus={preloadContinueSheet} onClick={() => setAsking(true)}>
          <Signpost size={18} weight="light" aria-hidden="true" /> Should I keep going?
        </Button>
      ) : null}
      {sendMounted ? <SendToFriendSheet open={sending} onOpenChange={setSending} title={{ mediaType, tmdbId, title, posterPath }} /> : null}
      {askMounted ? <ShouldContinueSheet tvId={tmdbId} title={title} open={asking} onOpenChange={setAsking} /> : null}
      {sheetMounted ? (
        <LibrarySheet
          open={open && (inLibrary === null || !entry.isLoading)}
          onOpenChange={setOpen}
          title={{ mediaType, tmdbId, title }}
          editing={inLibrary !== null}
          initial={
            entry.data
              ? {
                  status: entry.data.status,
                  rating: entry.data.rating,
                  note: entry.data.note,
                  worked: entry.data.worked,
                  didnt: entry.data.didnt,
                  watchedAt: entry.data.watchedAt,
                  customShelves: entry.data.customShelves,
                  hiddenFromFriends: entry.data.hiddenFromFriends,
                }
              : undefined
          }
          onSaved={() => {
            if (!inLibrary) void flyToNav(posterRect(), posterUrl, "library");
          }}
        />
      ) : null}
    </>
  );
}
