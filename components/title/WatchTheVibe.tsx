"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrailerModal, preloadTrailer } from "@/components/ui/LazyDialogs";
import type { Thumb } from "@/components/title/VibeTabs";
import { api } from "@/lib/api/client";
import type { MediaType, TitleVideo } from "@/lib/catalog/types";
import type { VibeVideo } from "@/lib/sources/youtube-classify";

type VideosResponse = { trailers: TitleVideo[]; edit: VibeVideo[]; review: VibeVideo[]; explained: VibeVideo[]; youtube: boolean };

function VideoSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-[var(--gutter)] sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="aspect-video" />
          <Skeleton className="mt-3 h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

const VibeTabs = dynamic(() => import("@/components/title/VibeTabs"), { ssr: false, loading: VideoSkeleton });

/** Trailers, fan edits, reviews and explainers — fetched only when the section scrolls near. */
export function WatchTheVibe({ mediaType, tmdbId, title }: { mediaType: MediaType; tmdbId: number; title: string }) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState<Thumb | null>(null);
  // The player mounts with the first play and stays, so closing it can animate.
  const [played, setPlayed] = useState(false);
  const play = (v: Thumb) => {
    setPlaying(v);
    setPlayed(true);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const videos = useQuery({
    queryKey: ["videos", mediaType, tmdbId],
    queryFn: () => {
      // The tabs' and the player's code come in with the list, ahead of the first click.
      void import("@/components/title/VibeTabs");
      preloadTrailer();
      return api<VideosResponse>(`/api/titles/${mediaType}/${tmdbId}/videos`);
    },
    enabled: near,
    staleTime: 60 * 60_000,
  });

  const d = videos.data;
  const tabs = [
    { value: "trailers", label: "Trailers", items: (d?.trailers ?? []).map((v) => ({ id: v.key, title: v.name, byline: v.official ? "Official" : null, duration: null })) },
    { value: "edits", label: "Edits", items: (d?.edit ?? []).map(toThumb) },
    { value: "reviews", label: "Reviews", items: (d?.review ?? []).map(toThumb) },
    { value: "explained", label: "Explained", items: (d?.explained ?? []).map(toThumb) },
  ].filter((t) => t.items.length > 0);

  if (d && tabs.length === 0) return null;

  return (
    <section ref={ref} className="page border-t border-hairline py-[var(--section-y)]">
      <SplitHeading className="text-h2">Watch the vibe</SplitHeading>
      <div className="mt-10">{d ? <VibeTabs tabs={tabs} onPlay={play} /> : <VideoSkeleton />}</div>
      {played ? (
        <TrailerModal videoId={playing?.id ?? null} title={playing?.title ?? `${title} video`} open={playing !== null} onOpenChange={(o) => !o && setPlaying(null)} />
      ) : null}
    </section>
  );
}

function toThumb(v: VibeVideo): Thumb {
  return { id: v.id, title: v.title, byline: v.channel, duration: v.durationSec || null };
}
