"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookmarkSimple, ClockCounterClockwise, Dna, FilmReel, FilmStrip, GearSix, House, MagnifyingGlass, MoonStars, Sparkle, SunHorizon, UsersThree } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/layout/ThemeToggle";
import { Kbd } from "@/components/ui/Kbd";
import { useRecentSearches } from "@/lib/api/ask";
import { useTitleSearch } from "@/lib/api/taste";
import { CATEGORY_LABEL } from "@/lib/catalog/category";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { tmdbImg } from "@/lib/images/tmdb";
import { usePalette } from "@/lib/store/palette";
import { setTheme } from "@/lib/theme";
import { ease } from "@/lib/motion";

const item =
  "flex cursor-pointer items-center gap-3 rounded-[4px] px-3 py-2.5 text-[0.9375rem] text-muted outline-none transition-colors data-[selected=true]:bg-raised data-[selected=true]:text-text";

/**
 * The command palette: instant title search, "Ask Reverie", recent searches and navigation.
 * Loaded on first open (see CommandPalette), so cmdk and the dialog stay off the critical path.
 */
export default function PaletteDialog() {
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);
  const reduced = useReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[90] bg-bg/75 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed left-1/2 top-[12svh] z-[91] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[6px] border border-hairline-strong bg-surface shadow-[0_40px_120px_-30px_rgb(0_0_0/0.85)]"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.25, ease: ease.out }}
              >
                <Dialog.Title className="sr-only">Search Reverie</Dialog.Title>
                <PaletteBody close={() => setOpen(false)} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const { status } = useAuth();
  const theme = useTheme();
  const [q, setQ] = useState("");
  const query = useDebounced(q, 150);
  const titles = useTitleSearch(query);
  const recent = useRecentSearches();
  const text = q.trim();
  const hasText = text.length >= 2;
  // Results for an older query aren't selectable (Enter must never open the wrong title).
  const stale = titles.isPlaceholderData || query.trim() !== text;

  const go = (href: string) => {
    close();
    router.push(href);
  };
  const results = hasText ? (titles.data?.results ?? []).slice(0, 6) : [];
  // "interstellar" wants the film; "something cozy for a slow sunday" wants Ask. Enter picks whichever leads.
  const descriptive = text.split(/\s+/).length >= 3 || /\b(like|with|for|but|something|movie|film|series|show|anime)\b/i.test(text);
  const leading = descriptive || stale || !results.length ? `ask:${text}` : results[0]!.key;
  // cmdk keeps its selection when items arrive later; a choice made with the arrow keys only
  // stands while the same item leads, otherwise the selection follows the new leader.
  const [pick, setPick] = useState({ value: "", leading: "" });
  const selected = pick.leading === leading ? pick.value : leading;
  const setSelected = (value: string) => setPick({ value, leading });

  const ask = (
    <Command.Group heading="Ask Reverie">
      <Command.Item value={`ask:${text}`} onSelect={() => go(`/search?q=${encodeURIComponent(text)}`)} className={item}>
        <FilmReel size={18} className="shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          Ask: <span className="text-text">“{text}”</span>
        </span>
        <span className="text-[0.75rem] text-muted">ranked for you</span>
      </Command.Item>
    </Command.Group>
  );
  const titleGroup = results.length ? (
    <Command.Group heading="Titles">
      {results.map((hit) => (
        <Command.Item key={hit.key} value={hit.key} disabled={stale} onSelect={() => go(hit.href)} className={`${item} data-[disabled=true]:opacity-50`}>
          <span className="relative aspect-[2/3] w-8 shrink-0 overflow-hidden rounded-[2px] bg-raised">
            {hit.posterPath ? <Image src={tmdbImg(hit.posterPath, "thumb")!} alt="" fill sizes="32px" className="object-cover" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-text">{hit.title}</span>
            <span className="block text-[0.75rem] text-muted">{[hit.year, CATEGORY_LABEL[hit.category]].filter(Boolean).join(" · ")}</span>
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  ) : null;

  return (
    <Command
      shouldFilter={false}
      loop
      label="Search Reverie"
      value={selected}
      onValueChange={setSelected}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[0.75rem] [&_[cmdk-group-heading]]:text-muted">
      <div className="flex items-center gap-3 border-b border-hairline px-4">
        <MagnifyingGlass size={18} aria-hidden="true" className="text-muted" />
        <Command.Input
          value={q}
          onValueChange={setQ}
          placeholder="Search titles, or describe a mood…"
          className="h-14 flex-1 bg-transparent text-[1.0625rem] text-text outline-none placeholder:text-muted"
        />
        <Kbd>esc</Kbd>
      </div>
      <Command.List data-lenis-prevent className="max-h-[min(60svh,28rem)] overflow-y-auto p-2">
        {hasText ? (
          descriptive || stale ? (
            <>
              {ask}
              {titleGroup}
            </>
          ) : (
            <>
              {titleGroup}
              {ask}
            </>
          )
        ) : (
          <>
            {status === "signed-in" && recent.data?.length ? (
              <Command.Group heading="Recent searches">
                {recent.data.slice(0, 5).map((r) => (
                  <Command.Item key={r} value={`recent:${r}`} onSelect={() => go(`/search?q=${encodeURIComponent(r)}`)} className={item}>
                    <ClockCounterClockwise size={18} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{r}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            <Command.Group heading="Go to">
              <Nav icon={<House size={18} />} label="Home" onSelect={() => go("/")} />
              <Nav icon={<MagnifyingGlass size={18} />} label="Search" onSelect={() => go("/search")} />
              {status === "signed-in" ? <Nav icon={<Sparkle size={18} />} label="What’s your mood tonight?" onSelect={() => go("/mood")} /> : null}
              {status === "signed-in" ? <Nav icon={<UsersThree size={18} />} label="Friends" onSelect={() => go("/friends")} /> : null}
              {status === "signed-in" ? <Nav icon={<Dna size={18} />} label="Your taste: eras and Wrapped" onSelect={() => go("/taste")} /> : null}
              {status === "signed-in" ? <Nav icon={<UsersThree size={18} />} label="Your Taste Twins" onSelect={() => go("/taste/twins")} /> : null}
              <Nav icon={<FilmStrip size={18} />} label="Library" onSelect={() => go("/library")} />
              <Nav icon={<BookmarkSimple size={18} />} label="Watchlist" onSelect={() => go("/watchlist")} />
              {status === "signed-in" ? <Nav icon={<GearSix size={18} />} label="Settings" onSelect={() => go("/settings")} /> : null}
            </Command.Group>
            <Command.Group heading="Appearance">
              <Nav
                icon={theme === "dark" ? <SunHorizon size={18} /> : <MoonStars size={18} />}
                label={theme === "dark" ? "Switch to the matinée (light) theme" : "Switch to the dark theme"}
                onSelect={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  close();
                }}
              />
            </Command.Group>
          </>
        )}
      </Command.List>
      <div className="flex items-center gap-4 border-t border-hairline px-4 py-2.5 text-[0.75rem] text-muted">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> open
        </span>
        <span className="ml-auto">Type a mood to ask Reverie</span>
      </div>
    </Command>
  );
}

function Nav({ icon, label, onSelect }: { icon: ReactNode; label: string; onSelect: () => void }) {
  return (
    <Command.Item value={`nav:${label}`} onSelect={onSelect} className={item}>
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      {label}
    </Command.Item>
  );
}
