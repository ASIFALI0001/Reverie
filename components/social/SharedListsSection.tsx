"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { FaceStack } from "@/components/social/FaceStack";
import { useCreateList, useFriends, useSharedLists, type ListSummary } from "@/lib/api/social";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";

/** /friends → Shared lists: the watchlists you keep with friends, and a way to start one. */
export function SharedListsSection() {
  const { data } = useSharedLists();
  const [creating, setCreating] = useState(false);
  const lists = data?.lists;
  return (
    <section aria-labelledby="shared-lists" className="mt-14 md:mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="shared-lists" className="flex items-baseline gap-3 font-display text-h3">
          Shared lists
          {lists?.length ? <span className="numeral text-[0.875rem] text-muted">{lists.length}</span> : null}
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus size={16} weight="light" aria-hidden="true" /> New shared list
        </Button>
      </div>
      <div className="mt-6">
        {!lists ? (
          <div aria-hidden="true" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-36 w-full rounded-[var(--radius-panel)]" />
            <Skeleton className="h-36 w-full rounded-[var(--radius-panel)]" />
          </div>
        ) : lists.length ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {lists.map((l) => (
              <li key={l.id}>
                <ListCard list={l} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-[56ch] border-t border-hairline pt-5 text-muted">
            A watchlist you keep with friends (“Weekend with Priya”). Everyone adds what they fancy; Reverie sorts it by what works for all of you, and can pick for you tonight.
          </p>
        )}
      </div>
      <CreateListSheet open={creating} onOpenChange={setCreating} />
    </section>
  );
}

function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="group flex h-full gap-4 rounded-[var(--radius-panel)] border border-hairline bg-surface p-4 transition-colors duration-200 hover:border-hairline-strong"
    >
      <span className="relative h-[6.5rem] w-[5.5rem] shrink-0" aria-hidden="true">
        {list.posters.length ? (
          list.posters.slice(0, 3).map((p, i) => (
            <span
              key={i}
              className="absolute top-0 aspect-[2/3] w-[4.25rem] overflow-hidden rounded-[2px] bg-raised shadow-[0_6px_16px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-out group-hover:-translate-y-0.5"
              style={{ left: i * 9, transform: `rotate(${(i - 1) * 4}deg)`, zIndex: 3 - i }}
            >
              {p ? <Image src={tmdbImg(p, "thumb")!} alt="" fill sizes="68px" className="object-cover" /> : null}
            </span>
          ))
        ) : (
          <span className="absolute inset-0 grid place-items-center rounded-[2px] border border-dashed border-hairline-strong text-meta text-muted">Empty</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[1.375rem] leading-tight group-hover:underline">{list.name}</span>
        <span className="mt-1 block text-meta text-muted">
          {list.count} title{list.count === 1 ? "" : "s"}
          {list.owner ? " · yours" : ""}
        </span>
        <FaceStack people={list.members} size={26} max={6} className="mt-3" />
        <span className="sr-only">With {list.members.map((m) => m.name).join(", ")}</span>
      </span>
    </Link>
  );
}

export function CreateListSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const friends = useFriends();
  const create = useCreateList();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const all = friends.data?.friends ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setName("");
          setPicked([]);
        }
      }}
      title="New shared list"
      description="Pick friends to keep it with. Everyone can add and remove titles."
    >
      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !picked.length) return;
          create.mutate(
            { name: name.trim(), members: picked },
            {
              onSuccess: ({ id }) => {
                onOpenChange(false);
                router.push(`/lists/${id}`);
              },
              onError: (err) => toast({ title: "Couldn’t create the list", description: err instanceof Error ? err.message : undefined, tone: "error" }),
            },
          );
        }}
      >
        <Field label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Weekend with Priya" autoFocus />
        {all.length ? (
          <fieldset>
            <legend className="text-meta text-muted">With</legend>
            <ul data-lenis-prevent className="mt-2 max-h-[min(16rem,42vh)] overflow-y-auto border-t border-hairline">
              {all.map((f) => (
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
          </fieldset>
        ) : (
          <p className="text-meta text-muted">Shared lists are for friends. Add a friend first, then start one together.</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || !picked.length} pending={create.isPending}>
            Create list
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
