"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { DotsThree, EyeSlash, PencilSimple, Signpost, Trash } from "@phosphor-icons/react";
import { PosterCard } from "@/components/title/PosterCard";
import { cardMeta } from "@/lib/catalog/cards";
import { tmdbImg } from "@/lib/images/tmdb";
import { formatRuntime } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { CATEGORY_SINGULAR } from "@/lib/catalog/category";
import type { LibraryEntry } from "@/lib/library/service";

export type ItemActions = {
  onEdit: (e: LibraryEntry) => void;
  onRemove: (e: LibraryEntry) => void;
  /** "Should I keep going?", for a series you're watching or dropped. */
  onAskContinue?: (e: LibraryEntry) => void;
};

const STATUS = { watched: "Watched", watching: "Watching", dropped: "Dropped" } as const;
const menuItem = "flex cursor-pointer select-none items-center gap-3 rounded-[4px] px-3 py-2.5 text-[0.9375rem] outline-none data-[highlighted]:bg-text/[0.06]";

function ItemMenu({ entry, actions, className }: { entry: LibraryEntry; actions: ItemActions; className?: string }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Options for ${entry.card.title}`}
        className={cn("grid size-8 place-items-center rounded-full bg-bg/85 text-text transition-opacity", className)}
      >
        <DotsThree size={18} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="menu-anim z-[70] min-w-48 rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-1.5">
          <DropdownMenu.Item className={menuItem} onSelect={() => actions.onEdit(entry)}>
            <PencilSimple size={16} weight="light" aria-hidden="true" /> Edit details
          </DropdownMenu.Item>
          {actions.onAskContinue && entry.card.mediaType === "tv" && entry.status !== "watched" ? (
            <DropdownMenu.Item className={menuItem} onSelect={() => actions.onAskContinue!(entry)}>
              <Signpost size={16} weight="light" aria-hidden="true" /> Should I keep going?
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item className={cn(menuItem, "text-danger")} onSelect={() => actions.onRemove(entry)}>
            <Trash size={16} weight="light" aria-hidden="true" /> Remove
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Badges({ entry }: { entry: LibraryEntry }) {
  if (entry.status === "watched" && !entry.rating && !entry.hiddenFromFriends) return null;
  return (
    <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
      {entry.hiddenFromFriends ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-bg/85 px-2 py-1 text-[0.6875rem] text-text" title="Hidden from friends">
          <EyeSlash size={12} weight="bold" aria-hidden="true" />
          <span className="sr-only">Hidden from friends</span>
        </span>
      ) : null}
      {entry.status !== "watched" ? (
        <span className="rounded-full bg-bg/85 px-2.5 py-1 text-[0.6875rem] text-text">{STATUS[entry.status]}</span>
      ) : null}
      {entry.rating ? <span className="numeral rounded-full bg-bg/85 px-2.5 py-1 text-[0.6875rem] text-text">★ {entry.rating / 2}</span> : null}
    </div>
  );
}

/** Poster grid; filter and sort changes make the posters glide to their new places. */
export function LibraryGrid({ items, actions }: { items: LibraryEntry[]; actions: ItemActions }) {
  return (
    <motion.ul layout className="grid grid-cols-2 gap-x-[var(--gutter)] gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((e) => (
          <motion.li
            key={e.key}
            layout
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
            transition={spring.soft}
            className="group/item relative"
          >
            <PosterCard
              href={e.card.href}
              title={e.card.title}
              titleKey={e.key}
              posterPath={e.card.posterPath}
              posterSrc={tmdbImg(e.card.posterPath) ?? ""}
              blur={e.card.posterBlur}
              color={e.card.color ?? undefined}
              year={e.card.year}
              meta={cardMeta(e.card)}
              match={e.match}
              sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 18vw, (min-width: 640px) 28vw, 44vw"
            />
            <Badges entry={e} />
            <ItemMenu entry={e} actions={actions} className="absolute right-2.5 top-2.5 opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100" />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

/** Posters standing on a quiet wooden ledge — the same data, a more tactile view. */
export function LibraryShelf({ items, actions }: { items: LibraryEntry[]; actions: ItemActions }) {
  return (
    <motion.ul layout className="grid grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-y-14">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((e) => (
          <motion.li
            key={e.key}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={spring.soft}
            className="group/item relative flex flex-col"
          >
            <div className="relative px-3 pt-2 [perspective:700px]">
              <Link
                href={e.card.href}
                data-cursor="view"
                className="relative block aspect-[2/3] origin-bottom overflow-hidden rounded-[2px] bg-surface shadow-[0_14px_14px_-10px_rgb(0_0_0/0.6)] transition-transform duration-500 ease-out [transform:rotateX(4deg)] group-hover/item:[transform:rotateX(0deg)_translateY(-4px)]"
              >
                {e.card.posterPath ? (
                  <Image src={tmdbImg(e.card.posterPath)!} alt={`${e.card.title} poster`} fill sizes="160px" className="object-cover" />
                ) : null}
              </Link>
              <Badges entry={e} />
              <ItemMenu entry={e} actions={actions} className="absolute right-4 top-3 opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100" />
            </div>
            {/* The ledge: adjacent cells touch, so each row reads as one plank. */}
            <div
              aria-hidden="true"
              className="h-3 bg-[linear-gradient(to_bottom,#4a3826,#2a1f15_70%,#1a130c)] shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_10px_18px_-8px_rgb(0_0_0/0.7)] light:bg-[linear-gradient(to_bottom,#d8c2a2,#b99c76_70%,#a3855f)]"
            />
            <p className="mt-3 truncate px-3 text-meta">{e.card.title}</p>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

export type ListSort = { key: "title" | "year" | "rating" | "imdb" | "runtime" | "added"; dir: "asc" | "desc" };

/** Dense, sortable table for people who like their shelves in rows. */
export function LibraryList({
  items,
  actions,
  sort,
  onSort,
}: {
  items: LibraryEntry[];
  actions: ItemActions;
  sort: ListSort;
  onSort: (key: ListSort["key"]) => void;
}) {
  const cols: { key: ListSort["key"]; label: string; className?: string }[] = [
    { key: "title", label: "Title" },
    { key: "year", label: "Year", className: "hidden sm:table-cell" },
    { key: "rating", label: "Your rating" },
    { key: "imdb", label: "IMDb", className: "hidden md:table-cell" },
    { key: "runtime", label: "Runtime", className: "hidden lg:table-cell" },
    { key: "added", label: "Added", className: "hidden md:table-cell" },
  ];
  return (
    <div className="-mx-[var(--page-x)] overflow-x-auto px-[var(--page-x)]">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline-strong">
            {cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                className={cn("py-3 pr-6 font-normal", c.className)}
              >
                <button type="button" onClick={() => onSort(c.key)} className={cn("caption hover:text-text", sort.key === c.key && "text-text")}>
                  {c.label}
                  {sort.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
            <th scope="col" className="w-10">
              <span className="sr-only">Options</span>
            </th>
          </tr>
        </thead>
        <motion.tbody layout>
          {items.map((e) => (
            <motion.tr layout key={e.key} transition={spring.soft} className="border-b border-hairline">
              <td className="py-3 pr-6">
                <Link href={e.card.href} className="group flex items-center gap-4">
                  <span className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-[2px] bg-surface">
                    {e.card.posterPath ? <Image src={tmdbImg(e.card.posterPath, "thumb")!} alt="" fill sizes="36px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate group-hover:underline">{e.card.title}</span>
                    <span className="block text-meta text-muted">
                      {CATEGORY_SINGULAR[e.card.category]} · {STATUS[e.status]}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="numeral hidden py-3 pr-6 text-meta sm:table-cell">{e.card.year ?? "—"}</td>
              <td className="numeral py-3 pr-6 text-meta">{e.rating ? `★ ${e.rating / 2}` : "—"}</td>
              <td className="numeral hidden py-3 pr-6 text-meta md:table-cell">{e.imdb ?? "—"}</td>
              <td className="numeral hidden py-3 pr-6 text-meta lg:table-cell">
                {e.card.mediaType === "tv" ? cardMeta(e.card) ?? "—" : (formatRuntime(e.card.runtime) ?? "—")}
              </td>
              <td className="numeral hidden py-3 pr-6 text-meta text-muted md:table-cell">
                {new Date(e.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="py-3">
                <ItemMenu entry={e} actions={actions} className="bg-transparent hover:bg-text/[0.06]" />
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
