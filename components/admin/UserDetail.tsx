"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, LockOpen, Prohibit } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { AdminError, StatusPill, dateOnly, dateTime } from "@/components/admin/parts";
import { ModerationDialog } from "@/components/admin/ModerationDialog";
import { ActivityTab, AdminTabPanel, FriendsTab, LibraryTab, ProfileTab, TasteTab, WatchlistTab } from "@/components/admin/user-tabs";
import { useAdminUser } from "@/lib/api/admin";
import { toast } from "@/lib/store/toast";
import type { AdminUserProfile } from "@/lib/admin/types";

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "taste", label: "Taste DNA" },
  { value: "library", label: "Library" },
  { value: "watchlist", label: "Watchlist" },
  { value: "friends", label: "Friends" },
  { value: "activity", label: "Activity" },
  { value: "admin", label: "Moderation" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

/**
 * /admin/users/[uid]: one account, everything about it. Opening the page and each private tab
 * is written to the audit log (by the API), and tabs load only when opened.
 */
export function UserDetail({ uid }: { uid: string }) {
  const params = useSearchParams();
  const fromUrl = params.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(fromUrl) ? fromUrl : "profile");
  const [opened, setOpened] = useState<Set<Tab>>(() => new Set([tab]));
  const [moderating, setModerating] = useState<"block" | "unblock" | null>(null);
  const { data: user, error, refetch } = useAdminUser(uid);

  function select(next: string) {
    if (!isTab(next)) return;
    setTab(next);
    setOpened((s) => (s.has(next) ? s : new Set(s).add(next)));
    const search = new URLSearchParams(window.location.search);
    if (next === "profile") search.delete("tab");
    else search.set("tab", next);
    const qs = search.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  return (
    <div className="max-w-[78rem]">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-meta text-muted hover:text-text">
        <ArrowLeft size={14} weight="light" aria-hidden="true" /> All users
      </Link>

      {error && !user ? (
        <AdminError error={error} onRetry={() => void refetch()} />
      ) : !user ? (
        <HeaderSkeleton />
      ) : (
        <>
          <Header user={user} onModerate={setModerating} />
          {user.block ? <BlockNotice block={user.block} /> : null}
          <Tabs defaultValue="profile" value={tab} onValueChange={select} className="mt-10">
            <TabsList label="About this account">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="profile" className="pt-8">
              <ProfileTab user={user} />
            </TabsContent>
            <TabsContent value="taste" className="pt-8">
              <TasteTab uid={uid} enabled={opened.has("taste")} />
            </TabsContent>
            <TabsContent value="library" className="pt-8">
              <LibraryTab uid={uid} enabled={opened.has("library")} />
            </TabsContent>
            <TabsContent value="watchlist" className="pt-8">
              <WatchlistTab uid={uid} enabled={opened.has("watchlist")} />
            </TabsContent>
            <TabsContent value="friends" className="pt-8">
              <FriendsTab uid={uid} enabled={opened.has("friends")} />
            </TabsContent>
            <TabsContent value="activity" className="pt-8">
              <ActivityTab uid={uid} enabled={opened.has("activity")} />
            </TabsContent>
            <TabsContent value="admin" className="pt-8">
              <AdminTabPanel user={user} enabled={opened.has("admin")} onModerate={setModerating} />
            </TabsContent>
          </Tabs>
          {moderating ? (
            <ModerationDialog
              target={{ uid, name: user.name, email: user.email }}
              mode={moderating}
              open
              onOpenChange={(o) => {
                if (!o) setModerating(null);
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Header({ user, onModerate }: { user: AdminUserProfile; onModerate: (mode: "block" | "unblock") => void }) {
  const admin = user.role === "admin" || user.firebase?.admin === true;
  return (
    <header className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="flex min-w-0 items-center gap-5">
        <Avatar name={user.name ?? user.email} photoURL={user.photoURL} avatar={user.avatar} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-h3">{user.name ?? "Unnamed"}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
            {user.handle ? <span>@{user.handle}</span> : null}
            {user.email ? <span className="break-all">{user.email}</span> : null}
            <StatusPill status={user.status} admin={admin} />
          </p>
          <p className="mt-1 text-meta text-muted">
            Joined {dateOnly(user.createdAt)} · Last active {dateTime(user.lastActiveAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void navigator.clipboard.writeText(user.uid).then(
              () => toast({ title: "User ID copied" }),
              () => toast({ title: "Couldn’t copy", tone: "error" }),
            )
          }
        >
          <Copy size={16} weight="light" aria-hidden="true" /> Copy ID
        </Button>
        {admin ? null : user.status === "blocked" ? (
          <Button variant="secondary" size="sm" onClick={() => onModerate("unblock")}>
            <LockOpen size={16} weight="light" aria-hidden="true" /> Unblock…
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={() => onModerate("block")}>
            <Prohibit size={16} weight="light" aria-hidden="true" /> Block…
          </Button>
        )}
      </div>
    </header>
  );
}

function BlockNotice({ block }: { block: NonNullable<AdminUserProfile["block"]> }) {
  return (
    <div role="status" className="mt-8 border-l-2 border-danger bg-danger/[0.06] px-5 py-4">
      <p className="text-[0.9375rem] text-text">
        Blocked {dateTime(block.at)}
        {block.until ? `, until ${dateTime(block.until)}` : ", until an admin lifts it"}
      </p>
      {block.reason ? <p className="mt-1 text-meta text-muted">“{block.reason}”</p> : null}
      <p className="mt-1 text-meta text-muted">{block.showReason ? "They can see this reason." : "The reason is hidden from them."}</p>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div aria-hidden="true" className="mt-6">
      <div className="flex items-center gap-5">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="mt-10 h-11 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  );
}
