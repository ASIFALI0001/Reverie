"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABEL,
  CATEGORY_TO_SEGMENT,
  GENRE_ORDER,
  parseShelf,
  shelfName,
  shelfToSegment,
} from "@/lib/library/shelves";
import type { LibraryOverview } from "@/lib/library/service";
import type { Category } from "@/lib/catalog/types";

const CATEGORIES: Category[] = ["movie", "series", "anime", "cartoon"];

export type ShelfSelection = { category: Category | null; shelf: string | null; custom: string | null; sent?: boolean };

type Group = { title: string; shelves: { slug: string; count: number }[] };

/** Genre shelves first (in a fixed, familiar order), then franchises, collections and anime tags. */
export function shelfGroups(o: LibraryOverview, category: Category): Group[] {
  const entries = Object.entries(o.shelves[category] ?? {}).map(([slug, count]) => ({ slug, count }));
  const byKind = (kind: string) => entries.filter((e) => parseShelf(e.slug)?.kind === kind);
  const genres = byKind("genre").sort((a, b) => {
    const ia = GENRE_ORDER.indexOf(parseShelf(a.slug)!.id);
    const ib = GENRE_ORDER.indexOf(parseShelf(b.slug)!.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.count - a.count;
  });
  const franchises = [...byKind("franchise"), ...byKind("collection")].sort((a, b) => b.count - a.count);
  const groups: Group[] = [];
  if (category === "anime" && byKind("anime").length) groups.push({ title: "Kinds of anime", shelves: byKind("anime").sort((a, b) => b.count - a.count) });
  if (genres.length) groups.push({ title: "Genres", shelves: genres });
  if (franchises.length) groups.push({ title: "Franchises", shelves: franchises });
  return groups;
}

export function hrefFor(sel: ShelfSelection) {
  if (sel.custom) return `/library/shelf/${sel.custom}`;
  if (!sel.category) return "/library";
  const base = `/library/${CATEGORY_TO_SEGMENT[sel.category]}`;
  return sel.shelf ? `${base}/${shelfToSegment(sel.shelf)}` : base;
}

function Row({ href, label, count, active, nested = false }: { href: string; label: string; count: number; active: boolean; nested?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-baseline justify-between gap-3 py-1.5 transition-colors",
          nested ? "pl-4 text-[0.9375rem]" : "text-[1.0625rem]",
          active ? "text-text" : "text-muted hover:text-text",
        )}
      >
        <span className={cn("truncate", active && "link-draw [background-size:100%_1px]")}>{label}</span>
        <span className="numeral shrink-0 text-[0.75rem] text-muted">{count}</span>
      </Link>
    </li>
  );
}

/** Desktop: a quiet index down the left. */
export function ShelfIndex({ overview, sel, sentCount = 0 }: { overview: LibraryOverview; sel: ShelfSelection; sentCount?: number }) {
  return (
    <nav aria-label="Library shelves" className="space-y-8">
      <ul>
        <Row href="/library" label="Everything" count={overview.total} active={!sel.category && !sel.custom && !sel.sent} />
        {sentCount || sel.sent ? <Row href="/library/sent" label="Sent to you" count={sentCount} active={Boolean(sel.sent)} /> : null}
        {CATEGORIES.map((c) => (
          <li key={c}>
            <ul>
              <Row href={hrefFor({ category: c, shelf: null, custom: null })} label={CATEGORY_LABEL[c]} count={overview.categories[c]} active={sel.category === c && !sel.shelf} />
              {sel.category === c
                ? shelfGroups(overview, c).map((g) => (
                    <li key={g.title} className="mb-2 mt-3">
                      <p className="caption pl-4">{g.title}</p>
                      <ul className="mt-1">
                        {g.shelves.map((s) => (
                          <Row
                            key={s.slug}
                            nested
                            href={hrefFor({ category: c, shelf: s.slug, custom: null })}
                            label={shelfName(s.slug, overview.collectionNames)}
                            count={s.count}
                            active={sel.shelf === s.slug}
                          />
                        ))}
                      </ul>
                    </li>
                  ))
                : null}
            </ul>
          </li>
        ))}
      </ul>
      {overview.custom.length ? (
        <div>
          <p className="caption">Your shelves</p>
          <ul className="mt-2">
            {overview.custom.map((s) => (
              <Row key={s.id} href={hrefFor({ category: null, shelf: null, custom: s.id })} label={s.name} count={s.count} active={sel.custom === s.id} />
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

/** Phones: two rows of chips instead of a sidebar. */
export function ShelfChips({ overview, sel, sentCount = 0 }: { overview: LibraryOverview; sel: ShelfSelection; sentCount?: number }) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[0.875rem] transition-colors",
      active ? "border-text bg-text text-bg" : "border-hairline-strong text-muted",
    );
  return (
    <nav aria-label="Library shelves" className="-mx-[var(--page-x)] space-y-3">
      <div className="flex gap-2 overflow-x-auto px-[var(--page-x)] [scrollbar-width:none]">
        <Link href="/library" className={chip(!sel.category && !sel.custom && !sel.sent)}>
          Everything <span className="numeral text-[0.75rem] opacity-60">{overview.total}</span>
        </Link>
        {sentCount || sel.sent ? (
          <Link href="/library/sent" className={chip(Boolean(sel.sent))}>
            Sent to you <span className="numeral text-[0.75rem] opacity-60">{sentCount}</span>
          </Link>
        ) : null}
        {CATEGORIES.map((c) => (
          <Link key={c} href={hrefFor({ category: c, shelf: null, custom: null })} className={chip(sel.category === c)}>
            {CATEGORY_LABEL[c]} <span className="numeral text-[0.75rem] opacity-60">{overview.categories[c]}</span>
          </Link>
        ))}
        {overview.custom.map((s) => (
          <Link key={s.id} href={hrefFor({ category: null, shelf: null, custom: s.id })} className={chip(sel.custom === s.id)}>
            {s.name}
          </Link>
        ))}
      </div>
      {sel.category ? (
        <div className="flex gap-2 overflow-x-auto px-[var(--page-x)] [scrollbar-width:none]">
          {shelfGroups(overview, sel.category)
            .flatMap((g) => g.shelves)
            .map((s) => (
              <Link
                key={s.slug}
                href={hrefFor({ category: sel.category, shelf: sel.shelf === s.slug ? null : s.slug, custom: null })}
                className={chip(sel.shelf === s.slug)}
              >
                {shelfName(s.slug, overview.collectionNames)}
              </Link>
            ))}
        </div>
      ) : null}
    </nav>
  );
}
