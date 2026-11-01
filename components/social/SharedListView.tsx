"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { DotsThree, MagnifyingGlass, Plus, Sparkle, X } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { FaceStack } from "@/components/social/FaceStack";
import { MemberBadges } from "@/components/social/MemberBadges";
import {
  useAddListMembers,
  useAddToList,
  useDeleteList,
  useFriends,
  usePickForTonight,
  useRemoveFromList,
  useRemoveListMember,
  useRenameList,
  useSharedList,
  type GroupPick,
  type ListView,
} from "@/lib/api/social";
import { useTitleSearch } from "@/lib/api/taste";
import { ApiClientError } from "@/lib/api/client";
import { cardMeta } from "@/lib/catalog/cards";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";

const menuItem = "flex cursor-pointer select-none items-center gap-3 rounded-[4px] px-3 py-2.5 text-[0.9375rem] text-text outline-none data-[highlighted]:bg-text/[0.06]";
const failed = (title: string) => (err: unknown) => toast({ title, description: err instanceof Error ? err.message : undefined, tone: "error" });

/** /lists/[id]: a watchlist kept with friends, sorted by what works for all of you. */
export function SharedListView({ id }: { id: string }) {
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+4.5rem)]">
      <AuthGuard fallback={<ListSkeleton />}>
        <ListBody id={id} />
      </AuthGuard>
    </div>
  );
}

function ListBody({ id }: { id: string }) {
  const { data, error, refetch, isFetching } = useSharedList(id);
  if (error && !data) {
    const gone = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="max-w-xl">
        <p className="font-display text-h2">{gone ? "This list isn’t there any more." : "This list didn’t load."}</p>
        <p className="mt-4 text-muted">{gone ? "It may have been deleted, or you’re no longer on it." : "Check your connection and try again."}</p>
        <div className="mt-8 flex gap-3">
          {gone ? null : <Button onClick={() => void refetch()}>Try again</Button>}
          <Button asChild variant="secondary">
            <Link href="/friends">Back to Friends</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!data) return <ListSkeleton />;
  return <List list={data} refreshing={isFetching} />;
}

function List({ list, refreshing }: { list: ListView; refreshing: boolean }) {
  const reduced = useReducedMotion();
  const pick = usePickForTonight(list.id);
  const remove = useRemoveFromList(list.id);
  const [picked, setPicked] = useState<GroupPick | null>(null);
  const owner = list.ownerUid === list.you;
  const others = list.members.filter((m) => m.uid !== list.you);
  const byUid = new Map(list.members.map((m) => [m.uid, m]));
  const pickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (picked) pickRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [picked, reduced]);

  function pickNow() {
    pick.mutate(undefined, {
      onSuccess: ({ pick: p }) => (p ? setPicked(p) : toast({ title: "Add a few titles first", description: "There’s nothing on the list to pick from yet." })),
      onError: failed("Couldn’t pick right now"),
    });
  }

  // Arriving from Mood Search's "With friends" (?pick=1): pick straight away, once.
  const autoPicked = useRef(false);
  const run = useRef(pickNow);
  useEffect(() => {
    run.current = pickNow;
  });
  useEffect(() => {
    if (autoPicked.current || !list.items.length) return;
    if (new URLSearchParams(window.location.search).get("pick") !== "1") return;
    autoPicked.current = true;
    run.current();
  }, [list.items.length]);

  return (
    <>
      <p className="text-meta text-muted">
        <Link href="/friends" className="link-draw">
          Friends
        </Link>{" "}
        / Shared lists
      </p>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <h1 className="max-w-[18ch] text-h1">{list.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <FaceStack people={list.members} size={30} max={8} />
            <p className="text-meta text-muted">You{others.length ? ` and ${others.map((m) => m.name.split(" ")[0]).join(", ")}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={pickNow} pending={pick.isPending} disabled={!list.items.length}>
            <Sparkle size={18} weight="light" aria-hidden="true" /> Pick for us tonight
          </Button>
          <ListMenu list={list} owner={owner} />
        </div>
      </header>

      <AnimatePresence>
        {picked ? (
          <motion.div
            ref={pickRef}
            key={picked.key}
            role="status"
            className="mt-10 grid grid-cols-[auto_minmax(0,1fr)] gap-5 rounded-[6px] border border-accent/50 bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-6"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.soft}
          >
            <Link href={picked.card.href} tabIndex={-1} aria-hidden="true" className="relative aspect-[2/3] w-20 overflow-hidden rounded-[2px] bg-raised md:w-24">
              {picked.card.posterPath ? <Image src={tmdbImg(picked.card.posterPath)!} alt="" fill sizes="96px" className="object-cover" /> : null}
            </Link>
            <div className="min-w-0">
              <p className="caption">Tonight, for all of you</p>
              <Link href={picked.card.href} className="mt-1 block font-display text-h3 leading-tight hover:underline">
                {picked.card.title}
              </Link>
              <p className="mt-2 max-w-[56ch] text-[1.0625rem] text-text/90">{picked.reason}</p>
              <MemberBadges className="mt-3" badges={picked.matches.flatMap((m) => (byUid.get(m.uid) ? [{ person: byUid.get(m.uid)!, match: m.match }] : []))} />
            </div>
            <div className="col-span-2 flex items-center gap-4 md:col-span-1 md:flex-col md:items-end">
              <p className="text-meta text-muted">
                Together <span className="numeral text-[1.25rem] text-text">{picked.combined}%</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Close
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AddTitle listId={list.id} existing={list.items.map((i) => i.key)} />

      <section aria-labelledby="list-titles" className={cn("mt-10 transition-opacity duration-300", refreshing && "opacity-80")}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="list-titles" className="flex items-baseline gap-3 font-display text-h3">
            On the list <span className="numeral text-[0.875rem] text-muted">{list.items.length}</span>
          </h2>
          <p className="max-w-[60ch] text-meta text-muted">Sorted by what works for all of you: the average match, minus a penalty whenever someone is below 50%.</p>
        </div>
        {list.items.length ? (
          <motion.ul layout={!reduced} className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {list.items.map((item, i) => {
                const adder = byUid.get(item.addedBy);
                const isPick = picked?.key === item.key;
                return (
                  <motion.li
                    key={item.key}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ ...spring.soft, delay: reduced ? 0 : Math.min(i, 8) * 0.03 }}
                    className={cn("group/card flex items-center gap-4 border-b border-hairline py-3.5", isPick && "rounded-[6px] bg-accent/[0.06] px-3")}
                  >
                    <span className="w-6 shrink-0 text-right text-meta text-muted tabular-nums">{i + 1}</span>
                    <Link href={item.card.href} tabIndex={-1} aria-hidden="true" className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-[2px] bg-surface">
                      {item.card.posterPath ? <Image src={tmdbImg(item.card.posterPath, "thumb")!} alt="" fill sizes="56px" className="object-cover" /> : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={item.card.href} className="block truncate text-[1.0625rem] hover:underline">
                        {item.card.title}
                      </Link>
                      <p className="truncate text-meta text-muted">
                        {[item.card.year, cardMeta(item.card)].filter(Boolean).join(" · ")}
                        {adder ? ` · added by ${adder.uid === list.you ? "you" : adder.name.split(" ")[0]}` : ""}
                      </p>
                      <MemberBadges
                        className="mt-2"
                        badges={item.matches.flatMap((m) => (byUid.get(m.uid) ? [{ person: byUid.get(m.uid)!, match: m.match }] : []))}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-right text-meta text-muted">
                        Together
                        <span className="numeral block text-[1.25rem] leading-none text-text">{item.combined != null ? `${item.combined}%` : "—"}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Take ${item.card.title} off the list`}
                        onClick={() =>
                          remove.mutate(
                            { mediaType: item.card.mediaType, tmdbId: item.card.tmdbId },
                            { onSuccess: () => toast({ title: `Took ${item.card.title} off the list` }), onError: failed("Couldn’t take it off") },
                          )
                        }
                        className="grid size-8 place-items-center rounded-full text-muted opacity-60 transition hover:bg-text/[0.06] hover:text-text hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X size={14} weight="light" />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        ) : (
          <div className="mt-6 border-t border-hairline pt-6">
            <p className="font-display text-h4">Nothing on it yet.</p>
            <p className="mt-2 max-w-[48ch] text-muted">Add something you’d all watch: search above, or use “Send to a friend” on any title page.</p>
          </div>
        )}
      </section>
    </>
  );
}

/** Search the catalog and add straight to the list. */
function AddTitle({ listId, existing }: { listId: string; existing: string[] }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const search = useTitleSearch(debounced);
  const add = useAddToList();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 220);
    return () => clearTimeout(t);
  }, [q]);
  const results = debounced.trim().length >= 2 ? (search.data?.results ?? []) : [];

  return (
    <div className="relative mt-10 max-w-xl">
      <label htmlFor="list-add" className="text-meta text-muted">
        Add a title
      </label>
      <div className="relative mt-1.5">
        <MagnifyingGlass size={18} weight="light" aria-hidden="true" className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="list-add"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search films and series"
          autoComplete="off"
          className="h-12 w-full rounded-none border-0 border-b border-hairline-strong bg-transparent pl-8 text-[1.0625rem] text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
        />
      </div>
      {results.length ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-[22rem] overflow-y-auto rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-1.5" data-lenis-prevent>
          {results.map((r) => {
            const on = existing.includes(r.key);
            return (
              <li key={r.key}>
                <button
                  type="button"
                  disabled={on || add.isPending}
                  onClick={() =>
                    add.mutate(
                      { id: listId, mediaType: r.mediaType, tmdbId: r.tmdbId },
                      {
                        onSuccess: () => {
                          toast({ title: `Added ${r.title}` });
                          setQ("");
                          setDebounced("");
                        },
                        onError: failed("Couldn’t add it"),
                      },
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-[4px] px-2.5 py-2 text-left transition-colors hover:bg-text/[0.06] disabled:opacity-50"
                >
                  <span className="relative aspect-[2/3] w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface">
                    {r.posterPath ? <Image src={tmdbImg(r.posterPath, "thumb")!} alt="" fill sizes="32px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem]">{r.title}</span>
                    <span className="block text-meta text-muted">{r.year ?? ""}</span>
                  </span>
                  <span className="text-meta text-muted">{on ? "On the list" : <Plus size={16} weight="light" aria-label="Add" />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ListMenu({ list, owner }: { list: ListView; owner: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"rename" | "people" | "leave" | "delete" | null>(null);
  const [name, setName] = useState(list.name);
  const rename = useRenameList(list.id);
  const leave = useRemoveListMember(list.id);
  const del = useDeleteList(list.id);
  const addPeople = useAddListMembers(list.id);
  const friends = useFriends();
  const [picked, setPicked] = useState<string[]>([]);
  const candidates = (friends.data?.friends ?? []).filter((f) => !list.members.some((m) => m.uid === f.person.uid));

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger aria-label="List options" className="grid size-11 place-items-center rounded-full border border-hairline-strong text-text transition-colors hover:border-text/45">
          <DotsThree size={20} weight="bold" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="menu-anim z-[70] min-w-52 rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-1.5">
            {owner ? (
              <>
                <DropdownMenu.Item className={menuItem} onSelect={() => setDialog("people")}>
                  Add people…
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} onSelect={() => setDialog("rename")}>
                  Rename…
                </DropdownMenu.Item>
              </>
            ) : null}
            <DropdownMenu.Item className={menuItem} onSelect={() => setDialog("leave")}>
              Leave the list…
            </DropdownMenu.Item>
            {owner ? (
              <DropdownMenu.Item className={cn(menuItem, "text-danger")} onSelect={() => setDialog("delete")}>
                Delete the list…
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => setDialog(o ? "rename" : null)} title="Rename the list">
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) rename.mutate(name.trim(), { onSuccess: () => setDialog(null), onError: failed("Couldn’t rename it") });
          }}
        >
          <Field label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="mt-8 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()} pending={rename.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Sheet open={dialog === "people"} onOpenChange={(o) => setDialog(o ? "people" : null)} title="Add people" description="Friends you add can see the list and add titles.">
        {candidates.length ? (
          <ul data-lenis-prevent className="mt-6 max-h-[min(16rem,42vh)] overflow-y-auto border-t border-hairline">
            {candidates.map((f) => (
              <li key={f.person.uid} className="border-b border-hairline">
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={picked.includes(f.person.uid)}
                    onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, f.person.uid] : cur.filter((u) => u !== f.person.uid)))}
                    className="size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  <Avatar name={f.person.name} photoURL={f.person.photoURL} avatar={f.person.avatar} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{f.person.name}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-muted">Every friend of yours is already on it.</p>
        )}
        <div className="mt-6 flex justify-end">
          <Button
            disabled={!picked.length}
            pending={addPeople.isPending}
            onClick={() =>
              addPeople.mutate(picked, {
                onSuccess: () => {
                  setPicked([]);
                  setDialog(null);
                },
                onError: failed("Couldn’t add them"),
              })
            }
          >
            Add to the list
          </Button>
        </div>
      </Sheet>

      <Dialog
        open={dialog === "leave"}
        onOpenChange={(o) => setDialog(o ? "leave" : null)}
        title="Leave this list?"
        description={owner ? "You own it: it passes to the next person on it. If you’re the last one, it’s deleted." : "You can be added again by whoever owns it."}
      >
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Stay
          </Button>
          <Button variant="danger" pending={leave.isPending} onClick={() => leave.mutate(list.you, { onSuccess: () => router.push("/friends"), onError: failed("Couldn’t leave") })}>
            Leave
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => setDialog(o ? "delete" : null)} title="Delete this list?" description="It’s removed for everyone on it. The titles stay wherever else they are.">
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Keep it
          </Button>
          <Button variant="danger" pending={del.isPending} onClick={() => del.mutate(undefined, { onSuccess: () => router.push("/friends"), onError: failed("Couldn’t delete it") })}>
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-20 w-80" />
      <Skeleton className="mt-12 h-12 w-full max-w-xl" />
      <div className="mt-10 grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="my-3 h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
