"use client";

/* eslint-disable @next/next/no-img-element -- YouTube thumbnails come straight from i.ytimg.com */
import { Play } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export type Thumb = { id: string; title: string; byline: string | null; duration: number | null };
export type VibeTab = { value: string; label: string; items: Thumb[] };

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function VideoTile({ v, onPlay }: { v: Thumb; onPlay: (v: Thumb) => void }) {
  return (
    <li>
      <button type="button" data-cursor="play" onClick={() => onPlay(v)} className="group block w-full text-left">
        <span className="relative block aspect-video overflow-hidden rounded-[var(--radius-poster)] bg-surface">
          <img
            src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/25">
            <span className="grid size-12 place-items-center rounded-full bg-bg/80 text-text transition-transform duration-300 group-hover:scale-110">
              <Play size={18} weight="fill" aria-hidden="true" />
            </span>
          </span>
          {v.duration ? (
            <span className="numeral absolute bottom-2 right-2 rounded-[3px] bg-black/75 px-1.5 py-0.5 text-[0.6875rem] text-white">
              {fmtDuration(v.duration)}
            </span>
          ) : null}
        </span>
        <span className="mt-3 line-clamp-2 block text-[0.9375rem] leading-snug">{v.title}</span>
        {v.byline ? <span className="mt-0.5 block text-meta text-muted">{v.byline}</span> : null}
      </button>
    </li>
  );
}

/** The tabbed video grid. Its own chunk: it only renders once the section's videos have loaded. */
export default function VibeTabs({ tabs, onPlay }: { tabs: VibeTab[]; onPlay: (v: Thumb) => void }) {
  return (
    <Tabs defaultValue={tabs[0]!.value}>
      <TabsList label="Video type">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} count={t.items.length}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="pt-8">
          <ul className="grid grid-cols-2 gap-x-[var(--gutter)] gap-y-8 lg:grid-cols-4">
            {t.items.slice(0, 8).map((v) => (
              <VideoTile key={v.id} v={v} onPlay={onPlay} />
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
