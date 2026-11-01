"use client";

import Link from "next/link";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import {
  Dna,
  GearSix,
  PaperPlaneTilt,
  SignOut,
  UsersThree,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { InvitePanel } from "@/components/social/InvitePanel";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMe } from "@/lib/api/me";

const item =
  "flex cursor-pointer select-none items-center gap-3 rounded-[4px] px-3 py-2.5 text-[0.9375rem] text-text outline-none data-[highlighted]:bg-text/[0.06]";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { data: me } = useMe();
  const name = me?.displayName ?? user?.displayName ?? user?.email ?? "You";
  const [inviting, setInviting] = useState(false);

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          aria-label="Your account"
          className="rounded-full transition-transform duration-150 active:scale-95"
        >
          <Avatar
            name={name}
            photoURL={me?.photoURL ?? user?.photoURL}
            avatar={
              me?.avatar ?? {
                kind: user?.photoURL ? "photo" : "monogram",
                tint: "tungsten",
              }
            }
            size={34}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={12}
            className="menu-anim z-[70] min-w-60 rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-1.5"
          >
            <div className="px-3 pb-2.5 pt-2">
              <p className="truncate text-[0.9375rem]">{name}</p>
              {me?.handle ? (
                <Link
                  href={`/u/${me.handle}`}
                  className="block truncate text-meta text-muted hover:text-text"
                >
                  @{me.handle}
                </Link>
              ) : user?.email ? (
                <p className="truncate text-meta text-muted">{user.email}</p>
              ) : null}
            </div>
            <DropdownMenu.Separator className="mx-1 my-1 h-px bg-hairline" />
            <DropdownMenu.Item asChild className={item}>
              <Link href="/friends">
                <UsersThree size={18} weight="light" aria-hidden="true" />{" "}
                Friends
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={item}
              onSelect={() => setInviting(true)}
            >
              <PaperPlaneTilt size={18} weight="light" aria-hidden="true" />{" "}
              Invite friends
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild className={item}>
              <Link href="/taste">
                <Dna size={18} weight="light" aria-hidden="true" /> Your taste
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="mx-1 my-1 h-px bg-hairline" />
            <DropdownMenu.Item asChild className={item}>
              <Link href="/settings">
                <GearSix size={18} weight="light" aria-hidden="true" /> Settings
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={() => void signOut()}>
              <SignOut size={18} weight="light" aria-hidden="true" /> Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Sheet
        open={inviting}
        onOpenChange={setInviting}
        title="Invite friends"
        description="Send your link, or let them scan the code."
      >
        <InvitePanel className="mt-6" bare />
      </Sheet>
    </>
  );
}
