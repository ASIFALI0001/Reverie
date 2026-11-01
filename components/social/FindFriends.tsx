"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchBadge } from "@/components/title/MatchRing";
import { RelationActions } from "@/components/social/RelationActions";
import { usePeopleSearch } from "@/lib/api/social";
import { cn } from "@/lib/cn";

/** "Find friends": search by @handle or name. People who opted out of search never appear. */
export function FindFriends({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 250);
    return () => clearTimeout(t);
  }, [text]);
  const search = usePeopleSearch(q);
  const results = search.data?.results ?? [];
  const searching = q.replace(/^@+/, "").trim().length >= 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Find friends" description="Search by @handle or name.">
      <label className="relative mt-6 block">
        <span className="sr-only">Handle or name</span>
        <MagnifyingGlass size={18} weight="light" aria-hidden="true" className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="@handle or name"
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full rounded-none border-0 border-b border-hairline-strong bg-transparent pl-8 text-[1.0625rem] text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
        />
      </label>
      <div aria-live="polite" className={cn("mt-4 min-h-[12rem] transition-opacity duration-300", search.isFetching && "opacity-70")}>
        {!searching ? (
          <p className="pt-2 text-meta text-muted">Type at least two letters. Someone not showing up? They may have turned search off: send them your invite link instead.</p>
        ) : search.isPending ? (
          <div aria-hidden="true" className="space-y-3 pt-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : results.length ? (
          <ul className="border-t border-hairline">
            {results.map((r) => (
              <li key={r.person.uid} className="flex items-center gap-3 border-b border-hairline py-3">
                <Link href={r.person.handle ? `/u/${r.person.handle}` : "#"} onClick={() => onOpenChange(false)} className="group flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={r.person.name} photoURL={r.person.photoURL} avatar={r.person.avatar} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] group-hover:underline">{r.person.name}</span>
                    <span className="flex items-center gap-2 text-meta text-muted">
                      {r.person.handle ? <span className="truncate">@{r.person.handle}</span> : null}
                      {r.match != null ? <MatchBadge value={r.match} className="bg-text/[0.06]" /> : null}
                    </span>
                  </span>
                </Link>
                <RelationActions person={r.person} relation={r.relation} friendshipId={r.friendshipId} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-2 text-muted">No one by that name or handle.</p>
        )}
      </div>
    </Sheet>
  );
}
