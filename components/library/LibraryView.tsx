"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { Rows, SquaresFour, Books } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/motion/CountUp";
import { LibrarySheet, ShouldContinueSheet } from "@/components/ui/LazyDialogs";
import {
  ShelfChips,
  ShelfIndex,
  type ShelfSelection,
} from "@/components/library/ShelfIndex";
import { TasteChart } from "@/components/library/TasteChart";
import {
  LibraryGrid,
  LibraryList,
  LibraryShelf,
  type ItemActions,
  type ListSort,
} from "@/components/library/LibraryViews";
import {
  useLibrary,
  useLibraryOverview,
  useRemoveFromLibrary,
} from "@/lib/api/library";
import { useInbox } from "@/lib/api/social";
import { SentInbox } from "@/components/social/SentToYou";
import {
  CATEGORY_LABEL,
  CATEGORY_SEGMENTS,
  emptyShelfLine,
  segmentToShelf,
  shelfName,
} from "@/lib/library/shelves";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";
import type { LibraryEntry } from "@/lib/library/service";
import type { LibraryStatus } from "@/lib/db/models/Library";

type View = "grid" | "shelf" | "list";
const VIEW_KEY = "reverie-library-view";

function useViewPreference(): [View, (v: View) => void] {
  const view = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return (localStorage.getItem(VIEW_KEY) as View | null) ?? "grid";
      } catch {
        return "grid";
      }
    },
    () => "grid" as View,
  );
  const set = (v: View) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
      window.dispatchEvent(new StorageEvent("storage", { key: VIEW_KEY }));
    } catch {
      // Storage unavailable: the choice just doesn't persist.
    }
  };
  return [view, set];
}

const SORTS = {
  added: (a: LibraryEntry, b: LibraryEntry) =>
    b.addedAt.localeCompare(a.addedAt),
  rating: (a: LibraryEntry, b: LibraryEntry) =>
    (b.rating ?? -1) - (a.rating ?? -1),
  imdb: (a: LibraryEntry, b: LibraryEntry) => (b.imdb ?? -1) - (a.imdb ?? -1),
  year: (a: LibraryEntry, b: LibraryEntry) =>
    (b.card.year ?? 0) - (a.card.year ?? 0),
  runtime: (a: LibraryEntry, b: LibraryEntry) =>
    (b.card.runtime ?? 0) - (a.card.runtime ?? 0),
  title: (a: LibraryEntry, b: LibraryEntry) =>
    a.card.title.localeCompare(b.card.title),
};
type SortKey = keyof typeof SORTS;
const SORT_LABEL: Record<SortKey, string> = {
  added: "Recently added",
  rating: "Your rating",
  imdb: "IMDb rating",
  year: "Release year",
  runtime: "Runtime",
  title: "A–Z",
};

function useSelection(): ShelfSelection {
  const params = useParams<{ path?: string[] }>();
  const [a, b] = params.path ?? [];
  if (a === "sent")
    return { category: null, shelf: null, custom: null, sent: true };
  if (a === "shelf") return { category: null, shelf: null, custom: b ?? null };
  const category = a ? (CATEGORY_SEGMENTS[a] ?? null) : null;
  return {
    category,
    shelf: category && b ? segmentToShelf(decodeURIComponent(b)) : null,
    custom: null,
  };
}

export function LibraryView() {
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <AuthGuard fallback={<LibrarySkeleton />}>
        <LibraryBody />
      </AuthGuard>
    </div>
  );
}

function LibraryBody() {
  const sel = useSelection();
  const overview = useLibraryOverview();
  const library = useLibrary({
    category: sel.category ?? undefined,
    shelf: sel.shelf ?? undefined,
    customShelf: sel.custom ?? undefined,
  });
  const remove = useRemoveFromLibrary();
  const inbox = useInbox();
  const sentCount = inbox.data?.waiting ?? 0;
  const [view, setView] = useViewPreference();
  const [statuses, setStatuses] = useState<LibraryStatus[]>([]);
  const [highRated, setHighRated] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [listSort, setListSort] = useState<ListSort>({
    key: "added",
    dir: "desc",
  });
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const [asking, setAsking] = useState<LibraryEntry | null>(null);

  const o = overview.data;
  const title = sel.sent
    ? "Sent to you"
    : sel.custom
      ? (o?.custom.find((c) => c.id === sel.custom)?.name ?? "Shelf")
      : sel.shelf
        ? shelfName(sel.shelf, o?.collectionNames)
        : sel.category
          ? CATEGORY_LABEL[sel.category]
          : "Your library";

  const items = useMemo(() => {
    let list = library.data?.items ?? [];
    if (statuses.length) list = list.filter((e) => statuses.includes(e.status));
    if (highRated) list = list.filter((e) => (e.rating ?? 0) >= 8);
    const key = view === "list" ? listSort.key : sortKey;
    const sorted = [...list].sort(SORTS[key]);
    if (view === "list" && listSort.dir === "asc") sorted.reverse();
    return sorted;
  }, [library.data, statuses, highRated, sortKey, listSort, view]);

  const actions: ItemActions = {
    onEdit: setEditing,
    onAskContinue: setAsking,
    onRemove: async (e) => {
      try {
        await remove.mutateAsync({
          mediaType: e.card.mediaType,
          tmdbId: e.card.tmdbId,
        });
        toast({ title: `Removed ${e.card.title}` });
      } catch (err) {
        toast({
          title: "Couldn’t remove that",
          description: err instanceof Error ? err.message : undefined,
          tone: "error",
        });
      }
    },
  };

  return (
    <>
      <header className="grid-editorial items-end gap-y-10">
        <div className="col-span-12 lg:col-span-7">
          {sel.category || sel.custom || sel.sent ? (
            <p className="text-meta text-muted">
              <Link href="/library" className="link-draw">
                Library
              </Link>
              {sel.shelf && sel.category ? (
                <>
                  {" / "}
                  <Link
                    href={`/library/${Object.entries(CATEGORY_SEGMENTS).find(([, c]) => c === sel.category)?.[0]}`}
                    className="link-draw"
                  >
                    {CATEGORY_LABEL[sel.category]}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          <h1 className="mt-3 text-h1">{title}</h1>
        </div>
        {o && !sel.category && !sel.custom && !sel.sent ? (
          <div className="col-span-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:col-span-5">
            <div>
              <p className="text-meta text-muted">Titles</p>
              <CountUp
                value={o.total}
                className="mt-1 block text-[2rem] font-light leading-none"
              />
            </div>
            <div>
              <p className="text-meta text-muted">Hours watched</p>
              <CountUp
                value={o.stats.hoursWatched}
                className="mt-1 block text-[2rem] font-light leading-none"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-meta text-muted">Top genres</p>
              <p className="mt-1 text-[1.0625rem] leading-snug">
                {o.stats.topGenres.map((g) => shelfName(g.slug)).join(", ") ||
                  "—"}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <TasteChart months={o.stats.months} />
            </div>
          </div>
        ) : null}
      </header>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          {o ? (
            <ShelfIndex overview={o} sel={sel} sentCount={sentCount} />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}
        </aside>
        <div className="lg:hidden">
          {o ? (
            <ShelfChips overview={o} sel={sel} sentCount={sentCount} />
          ) : null}
        </div>

        {sel.sent ? (
          <section aria-label="Sent to you by friends" className="min-w-0">
            <SentInbox />
          </section>
        ) : (
          <section aria-label={`${title} titles`} className="min-w-0">
            <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-hairline pb-5">
              {(["watched", "watching", "dropped"] as const).map((s) => (
                <Chip
                  key={s}
                  selected={statuses.includes(s)}
                  onToggle={(on) =>
                    setStatuses((cur) =>
                      on ? [...cur, s] : cur.filter((x) => x !== s),
                    )
                  }
                >
                  {s[0]!.toUpperCase() + s.slice(1)}
                </Chip>
              ))}
              <Chip selected={highRated} onToggle={setHighRated}>
                Rated 8+
              </Chip>
              <div className="ml-auto flex items-center gap-3">
                {view !== "list" ? (
                  <label className="flex items-center gap-2 text-meta text-muted">
                    <span className="sr-only sm:not-sr-only">Sort</span>
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      className="h-9 cursor-pointer rounded-full border border-hairline-strong bg-transparent px-3 text-[0.875rem] text-text outline-none"
                    >
                      {(Object.keys(SORTS) as SortKey[]).map((k) => (
                        <option key={k} value={k} className="bg-surface">
                          {SORT_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div
                  role="radiogroup"
                  aria-label="View"
                  className="flex rounded-full border border-hairline-strong p-0.5"
                >
                  {(
                    [
                      ["grid", SquaresFour, "Poster grid"],
                      ["shelf", Books, "Shelf"],
                      ["list", Rows, "List"],
                    ] as const
                  ).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={view === v}
                      aria-label={label}
                      title={label}
                      onClick={() => setView(v)}
                      className={cn(
                        "grid size-8 place-items-center rounded-full transition-colors",
                        view === v
                          ? "bg-text text-bg"
                          : "text-muted hover:text-text",
                      )}
                    >
                      <Icon size={16} weight={view === v ? "fill" : "light"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {library.isLoading ? (
              <GridSkeleton />
            ) : items.length === 0 ? (
              <div className="py-20 text-center">
                <p className="mx-auto max-w-[22ch] font-display text-h3">
                  {library.data?.items.length
                    ? "Nothing matches those filters."
                    : emptyShelfLine(sel.shelf, sel.category)}
                </p>
                {library.data?.items.length ? (
                  <Button
                    variant="secondary"
                    className="mt-8"
                    onClick={() => {
                      setStatuses([]);
                      setHighRated(false);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild className="mt-8">
                    <Link href="/search">Find something to add</Link>
                  </Button>
                )}
              </div>
            ) : view === "grid" ? (
              <LibraryGrid items={items} actions={actions} />
            ) : view === "shelf" ? (
              <LibraryShelf items={items} actions={actions} />
            ) : (
              <LibraryList
                items={items}
                actions={actions}
                sort={listSort}
                onSort={(key) =>
                  setListSort((s) => ({
                    key,
                    dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
                  }))
                }
              />
            )}
          </section>
        )}
      </div>

      {editing ? (
        <LibrarySheet
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={{
            mediaType: editing.card.mediaType,
            tmdbId: editing.card.tmdbId,
            title: editing.card.title,
          }}
          editing
          initial={{
            status: editing.status,
            rating: editing.rating,
            note: editing.note,
            worked: editing.worked,
            didnt: editing.didnt,
            watchedAt: editing.watchedAt,
            customShelves: editing.customShelves,
            hiddenFromFriends: editing.hiddenFromFriends,
          }}
        />
      ) : null}
      {asking ? (
        <ShouldContinueSheet
          tvId={asking.card.tmdbId}
          title={asking.card.title}
          open
          onOpenChange={(open) => !open && setAsking(null)}
        />
      ) : null}
    </>
  );
}

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-x-[var(--gutter)] gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3]" />
          <Skeleton className="mt-3 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-24 w-2/3 max-w-xl" />
      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-x-14 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-80 lg:block" />
        <GridSkeleton />
      </div>
    </div>
  );
}
