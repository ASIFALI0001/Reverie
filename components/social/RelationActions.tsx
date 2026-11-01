"use client";

import Link from "next/link";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { CaretDown, Check, Prohibit, UserMinus, UserPlus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useBlockPerson, useRemoveFriend, useRespondRequest, useSendRequest } from "@/lib/api/social";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/social/people";
import type { Relation } from "@/lib/social/visibility";

const menuItem =
  "flex cursor-pointer select-none items-center gap-3 rounded-[4px] px-3 py-2.5 text-[0.9375rem] text-text outline-none data-[highlighted]:bg-text/[0.06]";

const failed = (title: string) => (err: unknown) => toast({ title, description: err instanceof Error ? err.message : undefined, tone: "error" });

/**
 * The one button that says where you stand with someone, and moves you along:
 * Add friend → Requested (cancel) · Accept / Decline · Friends (remove, block).
 */
export function RelationActions({
  person,
  relation,
  friendshipId,
  via = "search",
  size = "sm",
  onAccepted,
  compact = false,
  className,
}: {
  person: Person;
  relation: Relation;
  friendshipId: string | null;
  via?: "search" | "profile";
  size?: "sm" | "md";
  /** Called once a request is accepted here (for the avatars-snap moment). */
  onAccepted?: () => void;
  /** Tight rows on phones: the Friends button shows just its check. */
  compact?: boolean;
  className?: string;
}) {
  const send = useSendRequest();
  const respond = useRespondRequest();
  const remove = useRemoveFriend();
  const [blocking, setBlocking] = useState(false);
  const first = person.name.split(" ")[0];

  if (relation === "self") return null;

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      {relation === "none" ? (
        <Button
          size={size}
          variant="secondary"
          pending={send.isPending}
          onClick={() =>
            send.mutate(
              { uid: person.uid, via },
              {
                onSuccess: (r) => toast({ title: r.relation === "friends" ? `You and ${first} are friends` : `Request sent to ${first}` }),
                onError: failed("Couldn’t send that request"),
              },
            )
          }
        >
          <UserPlus size={16} weight="light" aria-hidden="true" /> Add friend
        </Button>
      ) : relation === "request-received" && friendshipId ? (
        <>
          <Button
            size={size}
            pending={respond.isPending && respond.variables?.action === "accept"}
            onClick={() =>
              respond.mutate(
                { id: friendshipId, action: "accept" },
                { onSuccess: () => (onAccepted ? onAccepted() : toast({ title: `You and ${first} are friends` })), onError: failed("Couldn’t accept") },
              )
            }
          >
            <Check size={16} weight="bold" aria-hidden="true" /> Accept
          </Button>
          <Button
            size={size}
            variant="ghost"
            aria-label={`Decline ${person.name}’s request`}
            pending={respond.isPending && respond.variables?.action === "decline"}
            onClick={() => respond.mutate({ id: friendshipId, action: "decline" }, { onError: failed("Couldn’t decline") })}
          >
            Decline
          </Button>
        </>
      ) : (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button size={size} variant={relation === "friends" ? "secondary" : "ghost"} pending={remove.isPending}>
              {relation === "friends" ? (
                <>
                  <Check size={16} weight="bold" aria-hidden="true" /> <span className={cn(compact && "max-sm:sr-only")}>Friends</span>
                </>
              ) : (
                "Requested"
              )}
              <CaretDown size={12} weight="bold" aria-hidden="true" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="menu-anim z-[70] min-w-52 rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-1.5">
              {person.handle ? (
                <DropdownMenu.Item asChild className={menuItem}>
                  <Link href={`/u/${person.handle}`}>See profile</Link>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item
                className={menuItem}
                onSelect={() =>
                  remove.mutate(person.uid, {
                    onSuccess: () => toast({ title: relation === "friends" ? `Removed ${first} from your friends` : "Request cancelled" }),
                    onError: failed("That didn’t go through"),
                  })
                }
              >
                {relation === "friends" ? <UserMinus size={16} weight="light" aria-hidden="true" /> : <X size={16} weight="light" aria-hidden="true" />}
                {relation === "friends" ? "Remove friend" : "Cancel request"}
              </DropdownMenu.Item>
              <DropdownMenu.Item className={cn(menuItem, "text-danger")} onSelect={() => setBlocking(true)}>
                <Prohibit size={16} weight="light" aria-hidden="true" /> Block…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      <BlockDialog person={person} open={blocking} onOpenChange={setBlocking} />
    </div>
  );
}

/** Blocking is quiet: they aren't told, they just can't find or reach you any more. */
export function BlockDialog({ person, open, onOpenChange, onBlocked }: { person: Person; open: boolean; onOpenChange: (o: boolean) => void; onBlocked?: () => void }) {
  const block = useBlockPerson();
  const first = person.name.split(" ")[0];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Block ${person.name}?`}
      description={`${first} won’t be able to find you, see your profile or send you requests, and you won’t see them. They aren’t told. You can unblock them from Friends.`}
    >
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="danger"
          pending={block.isPending}
          onClick={() =>
            block.mutate(person.uid, {
              onSuccess: () => {
                onOpenChange(false);
                toast({ title: `${first} is blocked` });
                onBlocked?.();
              },
              onError: failed("Couldn’t block"),
            })
          }
        >
          Block
        </Button>
      </div>
    </Dialog>
  );
}
