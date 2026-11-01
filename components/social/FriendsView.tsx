"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass, PaperPlaneTilt } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchMini } from "@/components/title/MatchRing";
import { AvatarsSnap } from "@/components/social/AvatarsSnap";
import { FindFriends } from "@/components/social/FindFriends";
import { InvitePanel } from "@/components/social/InvitePanel";
import { RelationActions } from "@/components/social/RelationActions";
import { useMe } from "@/lib/api/me";
import { useFriends, useFriendsActivity, useUnblockPerson } from "@/lib/api/social";
import { ActivityList } from "@/components/social/ActivityStrip";
import { SharedListsSection } from "@/components/social/SharedListsSection";
import { toast } from "@/lib/store/toast";
import { spring } from "@/lib/motion";
import type { Person } from "@/lib/social/people";

/** /friends: the people you watch with, how your tastes match, and the way to bring more in. */
export function FriendsView() {
  const [finding, setFinding] = useState(false);
  const [inviting, setInviting] = useState(false);
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div>
          <h1 className="text-h1">Friends</h1>
          <p className="mt-4 max-w-[46ch] text-muted">The people you watch with. See how your tastes line up, and what they love.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setFinding(true)}>
            <MagnifyingGlass size={18} weight="light" aria-hidden="true" /> Find friends
          </Button>
          <Button onClick={() => setInviting(true)}>
            <PaperPlaneTilt size={18} weight="light" aria-hidden="true" /> Invite friends
          </Button>
        </div>
      </header>
      <AuthGuard fallback={<FriendsSkeleton />}>
        <FriendsBody onInvite={() => setInviting(true)} />
      </AuthGuard>
      <FindFriends open={finding} onOpenChange={setFinding} />
      <Sheet open={inviting} onOpenChange={setInviting} title="Invite friends" description="Send your link, or let them scan the code.">
        <InvitePanel className="mt-6" bare />
      </Sheet>
    </div>
  );
}

function Section({ id, title, count, children }: { id: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14 md:mt-20">
      <h2 id={id} className="flex items-baseline gap-3 font-display text-h3">
        {title}
        {count != null ? <span className="numeral text-[0.875rem] text-muted">{count}</span> : null}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function FriendsBody({ onInvite }: { onInvite: () => void }) {
  const { data, error, refetch } = useFriends();
  const { data: me } = useMe();
  const unblock = useUnblockPerson();
  const reduced = useReducedMotion();
  const [snapped, setSnapped] = useState<{ person: Person; match: number | null } | null>(null);

  if (error && !data) {
    return (
      <div className="mt-14 max-w-xl">
        <p className="font-display text-h3">Your friends didn’t load.</p>
        <Button className="mt-6" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data) return <FriendsSkeleton />;

  const empty = !data.friends.length && !data.requestsIn.length && !data.requestsOut.length;
  const myFace = { name: me?.displayName ?? "You", photoURL: me?.photoURL ?? null, avatar: me?.avatar ?? null };

  return (
    <div>
      <AnimatePresence>
        {snapped ? (
          <motion.div
            key={snapped.person.uid}
            role="status"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[var(--radius-panel)] border border-hairline-strong bg-surface p-5 md:p-6"
          >
            <AvatarsSnap a={myFace} b={snapped.person} size={52} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-h4">You and {snapped.person.name.split(" ")[0]} are friends now.</p>
              <p className="mt-1 text-meta text-muted">
                {snapped.match != null ? `${snapped.match}% taste match. ` : ""}They’ll see what you share with friends.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSnapped(null)}>
              Done
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {data.requestsIn.length ? (
        <Section id="requests-in" title="Waiting for you" count={data.requestsIn.length}>
          <ul className="border-t border-hairline">
            <AnimatePresence initial={false}>
              {data.requestsIn.map((r) => (
                <motion.li key={r.id} layout={!reduced} exit={{ opacity: 0, height: 0 }} transition={spring.soft} className="overflow-hidden border-b border-hairline">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                    <PersonLink person={r.person} match={r.match} sub="wants to be friends" />
                    <RelationActions
                      person={r.person}
                      relation="request-received"
                      friendshipId={r.id}
                      onAccepted={() => setSnapped({ person: r.person, match: r.match })}
                    />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Section>
      ) : null}

      {empty ? (
        <section className="mt-14 grid gap-10 border-t border-hairline pt-12 md:mt-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
          <div>
            <p className="font-display text-h2">No friends yet.</p>
            <p className="mt-4 max-w-[40ch] text-[1.0625rem] text-muted">Share your Taste DNA card and see who matches you. Friends see how your tastes line up, and only what you choose to share.</p>
            <Button variant="ghost" className="-ml-5 mt-4" onClick={onInvite}>
              Bigger card and share options
            </Button>
          </div>
          <InvitePanel />
        </section>
      ) : (
        <Section id="friends" title="Your friends" count={data.friends.length}>
          {data.friends.length ? (
            <ul className="grid grid-cols-1 gap-x-10 border-t border-hairline md:grid-cols-2">
              {data.friends.map((f, i) => (
                <motion.li
                  key={f.person.uid}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.soft, delay: reduced ? 0 : Math.min(i, 10) * 0.04 }}
                  className="flex items-center gap-4 border-b border-hairline py-4"
                >
                  <PersonLink person={f.person} sub={`Friends since ${new Date(f.since).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`} />
                  {f.match != null && f.person.handle ? (
                    <Link href={`/u/${f.person.handle}/compare`} aria-label={`${f.match}% taste match with ${f.person.name}: compare`} className="rounded-full transition-transform duration-200 hover:scale-105">
                      <MatchMini value={f.match} label="taste match" />
                    </Link>
                  ) : f.match != null ? (
                    <MatchMini value={f.match} label="taste match" />
                  ) : (
                    <span className="w-[3.25rem] text-center text-meta text-faint">—</span>
                  )}
                  <RelationActions person={f.person} relation="friends" friendshipId={null} compact />
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-hairline pt-5 text-muted">None yet: your requests are on their way.</p>
          )}
        </Section>
      )}

      {data.friends.length ? <FriendsActivitySection /> : null}

      <SharedListsSection />

      {data.requestsOut.length ? (
        <Section id="requests-out" title="Requests you sent" count={data.requestsOut.length}>
          <ul className="border-t border-hairline">
            {data.requestsOut.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-hairline py-4">
                <PersonLink person={r.person} match={r.match} sub="hasn’t answered yet" />
                <RelationActions person={r.person} relation="request-sent" friendshipId={r.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.blocked.length ? (
        <details className="group mt-14 border-t border-hairline pt-5 md:mt-20">
          <summary className="cursor-pointer list-none text-meta text-muted hover:text-text">
            People you blocked <span className="numeral">{data.blocked.length}</span>
            <span aria-hidden="true" className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-4">
            {data.blocked.map((b) => (
              <li key={b.person.uid} className="flex items-center gap-4 py-2.5">
                <Avatar name={b.person.name} photoURL={b.person.photoURL} avatar={b.person.avatar} size={32} />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{b.person.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  pending={unblock.isPending && unblock.variables === b.person.uid}
                  onClick={() => unblock.mutate(b.person.uid, { onSuccess: () => toast({ title: `${b.person.name} is unblocked` }) })}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function FriendsActivitySection() {
  const { data } = useFriendsActivity();
  if (!data?.items.length) return null;
  return (
    <Section id="friends-activity" title="Lately">
      <ActivityList items={data.items} />
    </Section>
  );
}

function PersonLink({ person, sub, match }: { person: Person; sub?: string; match?: number | null }) {
  const body = (
    <>
      <Avatar name={person.name} photoURL={person.photoURL} avatar={person.avatar} size={48} />
      <span className="min-w-0">
        <span className="block truncate text-[1.0625rem] group-hover:underline">{person.name}</span>
        <span className="block truncate text-meta text-muted">
          {person.handle ? `@${person.handle}` : null}
          {sub ? `${person.handle ? " · " : ""}${sub}` : null}
          {match != null ? ` · ${match}% taste match` : null}
        </span>
      </span>
    </>
  );
  return person.handle ? (
    <Link href={`/u/${person.handle}`} className="group flex min-w-0 flex-1 items-center gap-4">
      {body}
    </Link>
  ) : (
    <span className="flex min-w-0 flex-1 items-center gap-4">{body}</span>
  );
}

function FriendsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-14 md:mt-20">
      <Skeleton className="h-9 w-56" />
      <div className="mt-6 grid grid-cols-1 gap-x-10 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline py-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="size-[3.25rem] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
