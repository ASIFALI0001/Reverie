"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StepFrame } from "@/components/onboarding/StepFrame";
import { useTitleSearch } from "@/lib/api/taste";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { useOnboarding, type Favourite } from "@/lib/store/onboarding";
import { CATEGORY_LABEL } from "@/lib/catalog/category";
import { tmdbImg, tmdbImgUrl } from "@/lib/images/tmdb";
import { flyInto } from "@/lib/fx/fly";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { TitleHit } from "@/lib/search/types";

export function FavouritesStep() {
  const favourites = useOnboarding((s) => s.favourites);
  const addFavourite = useOnboarding((s) => s.addFavourite);
  const removeFavourite = useOnboarding((s) => s.removeFavourite);
  const next = useOnboarding((s) => s.next);
  const back = useOnboarding((s) => s.back);
  const [q, setQ] = useState("");
  const query = useDebounced(q, 220);
  const search = useTitleSearch(query);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const [flying, setFlying] = useState<string | null>(null);
  const full = favourites.length >= 3;

  async function pick(hit: TitleHit) {
    if (full || flying || favourites.some((f) => f.key === hit.key)) return;
    const fav: Favourite = { key: hit.key, title: hit.title, year: hit.year, posterPath: hit.posterPath };
    const from = document.querySelector<HTMLElement>(`[data-fav-thumb="${hit.key}"]`)?.getBoundingClientRect();
    const to = slots.current[favourites.length]?.getBoundingClientRect();
    const url = tmdbImgUrl(hit.posterPath, "w185");
    if (from && to && url) {
      setFlying(hit.key);
      await flyInto(from, url, to);
      setFlying(null);
    }
    addFavourite(fav);
    if (favourites.length + 1 >= 3) setQ("");
  }

  const results = query.trim().length >= 2 ? (search.data?.results ?? []) : [];
  // Results for an older query stay visible while the new ones load, but can't be picked:
  // typing fast and pressing Enter must never add the wrong film.
  const stale = search.isPlaceholderData || query.trim() !== q.trim();

  return (
    <StepFrame
      title={
        <>
          Three favourites, <em>ever</em>
        </>
      }
      lede="The ones you’d defend at any dinner table."
      footer={
        <>
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
          <Button onClick={next}>{favourites.length ? "Continue" : "Skip favourites"}</Button>
        </>
      }
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div className="order-2 lg:order-1">
          <Command shouldFilter={false} label="Find a favourite" className="w-full">
            <div className="relative">
              <MagnifyingGlass size={20} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                disabled={full}
                placeholder={full ? "Three picked. Swap one out to change." : "Search any film or series"}
                className="h-14 w-full rounded-full border border-hairline-strong bg-transparent pl-13 pr-5 text-[1.0625rem] text-text outline-none transition-colors placeholder:text-faint focus:border-text/50 disabled:opacity-60"
              />
            </div>
            <Command.List className={cn("mt-3 transition-opacity", (stale || search.isFetching) && "opacity-60")} data-lenis-prevent>
              {query.trim().length >= 2 && !search.isPending && results.length === 0 ? (
                <Command.Empty className="px-3 py-6 text-muted">Nothing matches “{query.trim()}”. Try the original title?</Command.Empty>
              ) : null}
              {results.map((hit) => {
                const chosen = favourites.some((f) => f.key === hit.key);
                return (
                  <Command.Item
                    key={hit.key}
                    value={hit.key}
                    disabled={chosen || full || stale}
                    onSelect={() => pick(hit)}
                    className="flex cursor-pointer items-center gap-4 rounded-[6px] px-3 py-2.5 transition-colors data-[disabled=true]:cursor-default data-[selected=true]:bg-raised data-[disabled=true]:opacity-45"
                  >
                    <span data-fav-thumb={hit.key} className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-[2px] bg-surface">
                      {hit.posterPath ? <Image src={tmdbImg(hit.posterPath, "thumb")!} alt="" fill sizes="40px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[1rem]">{hit.title}</span>
                      <span className="block text-meta text-muted">
                        {[hit.year, CATEGORY_LABEL[hit.category]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {chosen ? (
                      <Check size={18} className="text-accent" aria-label="Picked" />
                    ) : (
                      <Plus size={18} className="text-muted" aria-hidden="true" />
                    )}
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </div>

        <div className="order-1 lg:order-2">
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[0, 1, 2].map((i) => (
              <Slot
                key={i}
                ref={(el) => {
                  slots.current[i] = el;
                }}
                fav={favourites[i] ?? null}
                next={i === favourites.length}
                onRemove={removeFavourite}
              />
            ))}
          </div>
          <p className="mt-4 text-meta text-muted" aria-live="polite">
            {favourites.length === 0
              ? "Search, then pick up to three."
              : favourites.length < 3
                ? `${3 - favourites.length} to go.`
                : "Perfect. Change your mind any time."}
          </p>
        </div>
      </div>
    </StepFrame>
  );
}

function Slot({
  fav,
  next,
  onRemove,
  ref,
}: {
  fav: Favourite | null;
  next: boolean;
  onRemove: (key: Favourite["key"]) => void;
  ref: (el: HTMLDivElement | null) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div>
      <div
        ref={ref}
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-[2px] border transition-colors duration-300",
          fav ? "border-transparent" : next ? "border-accent/50 bg-accent/[0.04]" : "border-hairline-strong",
        )}
      >
        <AnimatePresence>
          {fav ? (
            <motion.div
              key={fav.key}
              className="absolute inset-0"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35, ease: ease.out }}
            >
              {fav.posterPath ? <Image src={tmdbImg(fav.posterPath)!} alt="" fill sizes="(min-width: 1024px) 140px, 30vw" className="object-cover" /> : null}
              <button
                type="button"
                onClick={() => onRemove(fav.key)}
                aria-label={`Remove ${fav.title}`}
                className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              >
                <X size={14} />
              </button>
            </motion.div>
          ) : (
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-faint">
              <Plus size={20} />
            </span>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-2 truncate text-meta text-muted">{fav ? fav.title : " "}</p>
    </div>
  );
}
