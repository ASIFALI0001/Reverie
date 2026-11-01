"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { DropdownMenu, ToggleGroup } from "radix-ui";
import { Copy, DotsThree, MagnifyingGlass, Prohibit, ArrowSquareOut, LockOpen, X } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminError, AdminHeader, METHOD_LABEL, Pager, StatusPill, dateOnly, when } from "@/components/admin/parts";
import { ModerationDialog, type ModerationTarget } from "@/components/admin/ModerationDialog";
import { useAdminUsers } from "@/lib/api/admin";
import { toast } from "@/lib/store/toast";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { AdminUserRow, UserListQuery, UserSort } from "@/lib/admin/types";

const SORTS: UserSort[] = ["joined", "-joined", "active", "-active", "name", "-name"];
const STATUSES = [
  { value: "", label: "Everyone" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
] as const;

const menuItem = "flex cursor-pointer select-none items-center gap-3 rounded-[4px] px-3 py-2.5 text-[0.9375rem] outline-none data-[highlighted]:bg-text/[0.06]";
const control = "h-10 rounded-full border border-hairline-strong bg-transparent px-4 text-[0.875rem] text-text outline-none focus-visible:border-[var(--tint)]";

/** The table's state lives in the URL, so a filtered view can be reloaded, shared and gone back to. */
function readQuery(params: URLSearchParams): UserListQuery {
  const status = params.get("status");
  const method = params.get("method");
  const sort = params.get("sort") as UserSort | null;
  return {
    query: params.get("q") ?? undefined,
    status: status === "active" || status === "blocked" ? status : undefined,
    method: method === "password" || method === "google.com" ? method : undefined,
    joinedFrom: params.get("from") ?? undefined,
    joinedTo: params.get("to") ?? undefined,
    sort: sort && SORTS.includes(sort) ? sort : "-joined",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

const URL_KEYS: Record<keyof UserListQuery, string> = {
  query: "q",
  status: "status",
  method: "method",
  joinedFrom: "from",
  joinedTo: "to",
  sort: "sort",
  page: "page",
};

/** /admin/users: search, filter, sort and page through every account (all on the server). */
export function UsersTable() {
  const params = useSearchParams();
  const pathname = usePathname();
  const q = readQuery(new URLSearchParams(params.toString()));
  const { data, error, isFetching, isPlaceholderData, refetch } = useAdminUsers(q);
  const [text, setText] = useState(q.query ?? "");
  const [moderating, setModerating] = useState<{ target: ModerationTarget; mode: "block" | "unblock" } | null>(null);

  /** Filters replace the history entry; turning a page adds one, so Back returns to it. */
  function update(patch: Partial<UserListQuery>) {
    const next = { ...q, page: 1, ...patch };
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(next) as [keyof UserListQuery, unknown][]) {
      if (v == null || v === "" || (k === "page" && v === 1) || (k === "sort" && v === "-joined")) continue;
      search.set(URL_KEYS[k], String(v));
    }
    const qs = search.toString();
    window.history[patch.page ? "pushState" : "replaceState"](null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  // Search as you type, a beat after the last key (and back to page one).
  useEffect(() => {
    const value = text.trim();
    if (value === (new URLSearchParams(window.location.search).get("q") ?? "")) return;
    const t = setTimeout(() => {
      // Read the URL again: another filter may have changed while the timer ran.
      const search = new URLSearchParams(window.location.search);
      if (value) search.set("q", value);
      else search.delete("q");
      search.delete("page");
      const qs = search.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  // Back and forward can change the search in the URL: the box follows.
  useEffect(() => {
    const onPop = () => setText(new URLSearchParams(window.location.search).get("q") ?? "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const toggleSort = (col: "joined" | "active" | "name") => {
    const current = q.sort ?? "-joined";
    // New column: newest/most recent first for dates, A→Z for names.
    const next: UserSort = current === col ? `-${col}` : current === `-${col}` ? col : col === "name" ? "name" : `-${col}`;
    update({ sort: next });
  };

  const filtered = Boolean(q.query || q.status || q.method || q.joinedFrom || q.joinedTo);

  return (
    <div className="max-w-[78rem]">
      <AdminHeader eyebrow="Control room" title="Users" sub={data ? `${data.total.toLocaleString("en-GB")} ${filtered ? "matching" : "accounts"}` : undefined} />

      <div role="search" className="mt-8 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[16rem] flex-1 sm:max-w-sm">
          <span className="sr-only">Search users</span>
          <MagnifyingGlass size={18} weight="light" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name, email, @handle or user ID"
            className={cn(control, "w-full pl-11 placeholder:text-faint")}
          />
        </label>
        <ToggleGroup.Root
          type="single"
          value={q.status ?? ""}
          onValueChange={(v) => update({ status: (v || undefined) as UserListQuery["status"] })}
          aria-label="Status"
          className="flex rounded-full border border-hairline-strong p-1"
        >
          {STATUSES.map((s) => (
            <ToggleGroup.Item
              key={s.value}
              value={s.value}
              className={cn(
                "h-8 rounded-full px-3.5 text-[0.875rem] transition-colors duration-200",
                (q.status ?? "") === s.value ? "bg-text text-bg" : "text-muted hover:text-text",
              )}
            >
              {s.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <label>
          <span className="sr-only">Sign-up method</span>
          <select
            value={q.method ?? ""}
            onChange={(e) => update({ method: (e.target.value || undefined) as UserListQuery["method"] })}
            className={cn(control, "appearance-none pr-8 [background:linear-gradient(45deg,transparent_50%,currentColor_50%)_calc(100%-18px)_52%/5px_5px_no-repeat,linear-gradient(135deg,currentColor_50%,transparent_50%)_calc(100%-13px)_52%/5px_5px_no-repeat]")}
          >
            <option value="">Any sign-up</option>
            <option value="password">Email</option>
            <option value="google.com">Google</option>
          </select>
        </label>
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Joined between</legend>
          <label>
            <span className="sr-only">Joined from</span>
            <input
              type="date"
              value={q.joinedFrom ?? ""}
              max={q.joinedTo}
              onChange={(e) => update({ joinedFrom: e.target.value || undefined })}
              className={cn(control, "w-[9.5rem] px-3 [color-scheme:inherit]", !q.joinedFrom && "text-muted")}
            />
          </label>
          <span aria-hidden="true" className="text-muted">
            –
          </span>
          <label>
            <span className="sr-only">Joined to</span>
            <input
              type="date"
              value={q.joinedTo ?? ""}
              min={q.joinedFrom}
              onChange={(e) => update({ joinedTo: e.target.value || undefined })}
              className={cn(control, "w-[9.5rem] px-3 [color-scheme:inherit]", !q.joinedTo && "text-muted")}
            />
          </label>
        </fieldset>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              update({ query: undefined, status: undefined, method: undefined, joinedFrom: undefined, joinedTo: undefined });
            }}
            className="inline-flex h-10 items-center gap-1.5 px-2 text-meta text-muted hover:text-text"
          >
            <X size={14} weight="light" aria-hidden="true" /> Clear filters
          </button>
        ) : null}
      </div>

      {error && !data ? (
        <AdminError error={error} onRetry={() => void refetch()} />
      ) : (
        <div className={cn("mt-8 transition-opacity duration-300", isFetching && isPlaceholderData && "opacity-60")} aria-busy={isFetching || undefined}>
          <div className="-mx-5 overflow-x-auto px-5 md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
            <table className="w-full border-collapse text-left md:min-w-[44rem]">
              <thead>
                <tr className="border-b border-hairline-strong">
                  <SortHeader label="User" col="name" sort={q.sort} onSort={toggleSort} />
                  <th scope="col" className="caption hidden py-3 pr-6 font-normal md:table-cell">
                    Status
                  </th>
                  <SortHeader label="Joined" col="joined" sort={q.sort} onSort={toggleSort} className="hidden md:table-cell" />
                  <SortHeader label="Last active" col="active" sort={q.sort} onSort={toggleSort} className="hidden lg:table-cell" />
                  <th scope="col" className="caption hidden py-3 pr-6 text-right font-normal md:table-cell">
                    Library
                  </th>
                  <th scope="col" className="caption hidden py-3 pr-6 text-right font-normal xl:table-cell">
                    Friends
                  </th>
                  <th scope="col" className="caption hidden py-3 pr-6 font-normal xl:table-cell">
                    Sign-up
                  </th>
                  <th scope="col" className="w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              {data ? (
                <Rows rows={data.rows} onModerate={(target, mode) => setModerating({ target, mode })} />
              ) : (
                <tbody aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className="border-b border-hairline">
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-9 rounded-full" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: 4 }, (_, j) => (
                        <td key={j} className={cn("py-3 pr-6", j === 2 ? "hidden lg:table-cell" : "hidden md:table-cell")}>
                          <Skeleton className="h-4 w-16" />
                        </td>
                      ))}
                      <td className="hidden xl:table-cell" />
                      <td className="hidden xl:table-cell" />
                      <td />
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {data && data.rows.length === 0 ? (
            <p className="mt-8 text-muted">{filtered ? "Nobody matches those filters." : "No accounts yet."}</p>
          ) : null}
          {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} noun={["account", "accounts"]} /> : null}
        </div>
      )}

      {moderating ? (
        <ModerationDialog
          target={moderating.target}
          mode={moderating.mode}
          open
          onOpenChange={(o) => {
            if (!o) setModerating(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  col,
  sort = "-joined",
  onSort,
  className,
}: {
  label: string;
  col: "joined" | "active" | "name";
  sort?: UserSort;
  onSort: (col: "joined" | "active" | "name") => void;
  className?: string;
}) {
  const dir = sort === col ? "ascending" : sort === `-${col}` ? "descending" : null;
  return (
    <th scope="col" aria-sort={dir ?? "none"} className={cn("py-3 pr-6 font-normal", className)}>
      <button type="button" onClick={() => onSort(col)} className={cn("caption hover:text-text", dir && "text-text")}>
        {label}
        {dir === "ascending" ? " ↑" : dir === "descending" ? " ↓" : ""}
      </button>
    </th>
  );
}

function Rows({ rows, onModerate }: { rows: AdminUserRow[]; onModerate: (t: ModerationTarget, mode: "block" | "unblock") => void }) {
  const reduced = useReducedMotion();
  return (
    <motion.tbody layout={!reduced}>
      {rows.map((u, i) => {
        const href = `/admin/users/${encodeURIComponent(u.uid)}`;
        return (
          <motion.tr
            key={u.uid}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: reduced ? 0 : Math.min(i, 12) * 0.018 }}
            className="group border-b border-hairline transition-colors hover:bg-text/[0.025]"
          >
            <td className="py-2.5 pr-6">
              <Link href={href} className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name ?? u.email} photoURL={u.photoURL} avatar={u.avatar} size={36} />
                <span className="min-w-0">
                  <span className="block max-w-[18rem] truncate text-[0.9375rem] group-hover:underline">{u.name ?? "Unnamed"}</span>
                  <span className="block max-w-[18rem] truncate text-meta text-muted">
                    {u.handle ? `@${u.handle} · ` : ""}
                    {u.email ?? "No email"}
                  </span>
                  {/* Phones: the columns that don't fit, folded under the name. */}
                  <span className="mt-1 flex items-center gap-3 md:hidden">
                    <StatusPill status={u.status} admin={u.role === "admin"} />
                    <span className="text-meta text-muted">Joined {dateOnly(u.createdAt)}</span>
                  </span>
                </span>
              </Link>
            </td>
            <td className="hidden py-2.5 pr-6 md:table-cell">
              <StatusPill status={u.status} admin={u.role === "admin"} />
            </td>
            <td className="hidden whitespace-nowrap py-2.5 pr-6 text-meta text-muted md:table-cell">{dateOnly(u.createdAt)}</td>
            <td className="hidden whitespace-nowrap py-2.5 pr-6 text-meta text-muted lg:table-cell">{when(u.lastActiveAt)}</td>
            <td className="hidden py-2.5 pr-6 text-right text-meta tabular-nums md:table-cell">{u.libraryCount.toLocaleString("en-GB")}</td>
            <td className="hidden py-2.5 pr-6 text-right text-meta tabular-nums xl:table-cell">{u.friendsCount.toLocaleString("en-GB")}</td>
            <td className="hidden py-2.5 pr-6 text-meta text-muted xl:table-cell">{u.signUpMethod ? (METHOD_LABEL[u.signUpMethod] ?? u.signUpMethod) : "—"}</td>
            <td className="py-2.5">
              <RowMenu user={u} href={href} onModerate={onModerate} />
            </td>
          </motion.tr>
        );
      })}
    </motion.tbody>
  );
}

function RowMenu({ user, href, onModerate }: { user: AdminUserRow; href: string; onModerate: (t: ModerationTarget, mode: "block" | "unblock") => void }) {
  const target = { uid: user.uid, name: user.name, email: user.email };
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${user.name ?? user.email ?? user.uid}`}
        className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-text/[0.06] hover:text-text data-[state=open]:bg-text/[0.06] data-[state=open]:text-text"
      >
        <DotsThree size={18} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="menu-anim z-[70] min-w-52 rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-1.5">
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href={href}>
              <ArrowSquareOut size={16} weight="light" aria-hidden="true" /> Open profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() =>
              void navigator.clipboard.writeText(user.uid).then(
                () => toast({ title: "User ID copied" }),
                () => toast({ title: "Couldn’t copy", tone: "error" }),
              )
            }
          >
            <Copy size={16} weight="light" aria-hidden="true" /> Copy user ID
          </DropdownMenu.Item>
          {user.role === "admin" ? null : user.status === "blocked" ? (
            <DropdownMenu.Item className={menuItem} onSelect={() => onModerate(target, "unblock")}>
              <LockOpen size={16} weight="light" aria-hidden="true" /> Unblock…
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item className={cn(menuItem, "text-danger")} onSelect={() => onModerate(target, "block")}>
              <Prohibit size={16} weight="light" aria-hidden="true" /> Block…
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
