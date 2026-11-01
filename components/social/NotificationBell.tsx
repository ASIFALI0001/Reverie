"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import { Bell } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useMarkNotificationsRead, useNotifications, useRespondRequest, type NotificationView } from "@/lib/api/social";
import { timeAgo } from "@/lib/format";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";

/**
 * The bell: friend requests (answerable right here), accepted requests, and later titles friends
 * send. Polls once a minute; a soft ring when something new arrives; opening it marks all read.
 */
export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const unread = data?.unread ?? 0;

  // Ring once each time the unread count goes up (not on the first load).
  const seen = useRef<number | null>(null);
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (seen.current != null && unread > seen.current) setRing((r) => r + 1);
    seen.current = unread;
  }, [unread]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && unread) markRead.mutate(undefined);
      }}
    >
      <Popover.Trigger
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        className="relative grid size-10 place-items-center rounded-full text-text transition-colors hover:bg-text/[0.06] data-[state=open]:bg-text/[0.06]"
      >
        <motion.span
          key={ring}
          className="grid place-items-center"
          style={{ transformOrigin: "50% 12%" }}
          animate={ring && !reduced ? { rotate: [0, 16, -13, 9, -6, 3, 0] } : undefined}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          <Bell size={21} weight={unread ? "regular" : "light"} />
        </motion.span>
        {unread ? (
          <motion.span
            key={`dot-${ring}`}
            aria-hidden="true"
            className="numeral absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] leading-none text-accent-ink"
            initial={reduced ? false : { scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="menu-anim z-[70] w-[min(24rem,calc(100vw-1.5rem))] rounded-[var(--radius-panel)] border border-hairline-strong bg-raised"
        >
          <div className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
            <p className="font-display text-[1.25rem]">Notifications</p>
            <Link href="/friends" onClick={() => setOpen(false)} className="text-meta text-muted hover:text-text">
              Friends
            </Link>
          </div>
          {data?.items.length ? (
            <ul data-lenis-prevent className="max-h-[min(28rem,70vh)] overflow-y-auto overscroll-contain py-1">
              {data.items.map((n) => (
                <Item key={n.id} n={n} onNavigate={() => setOpen(false)} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-meta text-muted">Nothing new. Friend requests and titles friends send you show up here.</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Item({ n, onNavigate }: { n: NotificationView; onNavigate: () => void }) {
  const respond = useRespondRequest();
  const who = n.actor;
  const profile = who?.handle ? `/u/${who.handle}` : "/friends";
  const title = typeof n.payload.title === "string" ? n.payload.title : "a title";
  const rating = typeof n.payload.rating === "number" ? ` · ${n.payload.rating}/10` : "";
  const text =
    n.type === "friend_request"
      ? n.state === "accepted"
        ? "is your friend now"
        : n.state === "gone"
          ? "sent a friend request (withdrawn)"
          : "wants to be friends"
      : n.type === "friend_accepted"
        ? "accepted your friend request"
        : n.type === "recommendation"
          ? `sent you ${title}`
          : n.type === "recommendation_reaction"
            ? n.payload.kind === "watchlisted"
              ? `added ${title} to their watchlist`
              : n.payload.kind === "watched"
                ? `watched ${title}${rating}`
                : `says ${title} isn’t for them`
            : n.type === "shared_list_invite"
              ? `added you to “${typeof n.payload.name === "string" ? n.payload.name : "a shared list"}”`
              : n.type === "twin_connect"
                ? n.payload.mutual
                  ? "is your friend now: you met as Taste Twins"
                  : "A Taste Twin would like to connect"
                : "sent you something";
  const href =
    n.type === "recommendation"
      ? "/library/sent"
      : n.type === "shared_list_invite" && typeof n.payload.listId === "string"
        ? `/lists/${n.payload.listId}`
        : n.type === "twin_connect" && !n.payload.mutual
          ? "/taste/twins"
          : null;

  return (
    <li className={cn("flex gap-3 px-4 py-3", !n.read && "bg-accent/[0.06]")}>
      {who ? <Avatar name={who.name} photoURL={who.photoURL} avatar={who.avatar} size={36} /> : <span className="size-9" />}
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] leading-snug">
          {who ? (
            <Link href={profile} onClick={onNavigate} className="hover:underline">
              {who.name}
            </Link>
          ) : null}{" "}
          {href ? (
            <Link href={href} onClick={onNavigate} className="text-muted hover:text-text hover:underline">
              {text}
            </Link>
          ) : (
            <span className="text-muted">{text}</span>
          )}
        </p>
        {n.type === "recommendation" && typeof n.payload.note === "string" && n.payload.note ? (
          <p className="mt-1 line-clamp-2 font-display text-[1rem] italic text-text/90">“{n.payload.note}”</p>
        ) : null}
        <p className="mt-0.5 text-meta text-muted">{timeAgo(n.at)}</p>
        {n.type === "friend_request" && n.state === "pending" && typeof n.payload.friendshipId === "string" ? (
          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              pending={respond.isPending && respond.variables?.action === "accept"}
              onClick={() =>
                respond.mutate(
                  { id: n.payload.friendshipId as string, action: "accept" },
                  { onSuccess: () => toast({ title: `You and ${who?.name.split(" ")[0] ?? "they"} are friends` }) },
                )
              }
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              pending={respond.isPending && respond.variables?.action === "decline"}
              onClick={() => respond.mutate({ id: n.payload.friendshipId as string, action: "decline" })}
            >
              Decline
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
