"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { PersonRef } from "@/lib/admin/types";

/** Small shared pieces of the control room. */

export function AdminHeader({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        <p className="caption">{eyebrow}</p>
        <h1 className="mt-1.5 text-h3">{title}</h1>
        {sub ? <p className="mt-2 text-meta text-muted">{sub}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function SectionTitle({ id, title, sub }: { id?: string; title: string; sub?: string }) {
  return (
    <div>
      <h2 id={id} className="text-[1.375rem] leading-tight">
        {title}
      </h2>
      {sub ? <p className="mt-1 text-meta text-muted">{sub}</p> : null}
    </div>
  );
}

export function AdminError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiClientError ? error.message : "Couldn’t load this. Check your connection and try again.";
  return (
    <div role="alert" className="mt-10 max-w-[44ch] border-t border-hairline-strong pt-5">
      <p className="text-text">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Account state as a word with a dot. The dot is never the only signal. */
export function StatusPill({ status, admin = false }: { status: "active" | "blocked"; admin?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-meta">
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", status === "blocked" ? "bg-danger" : "bg-text/40")} />
      <span className={status === "blocked" ? "text-danger" : "text-muted"}>{status === "blocked" ? "Blocked" : "Active"}</span>
      {admin ? <span className="rounded-full border border-accent/50 px-2 py-px text-[0.6875rem] text-accent">Admin</span> : null}
    </span>
  );
}

export function PersonLink({ person, sub }: { person: PersonRef; sub?: ReactNode }) {
  return (
    <Link href={`/admin/users/${encodeURIComponent(person.uid)}`} className="group flex min-w-0 items-center gap-3">
      <Avatar name={person.name} photoURL={person.photoURL} avatar={person.avatar} size={32} />
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] group-hover:underline">{person.name}</span>
        <span className="block truncate text-meta text-muted">
          {person.handle ? `@${person.handle}` : "No handle yet"}
          {person.blocked ? " · Blocked" : ""}
          {sub ? <> · {sub}</> : null}
        </span>
      </span>
    </Link>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  noun: [string, string];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4">
      <p className="text-meta text-muted">
        {total ? `${from.toLocaleString("en-GB")}–${to.toLocaleString("en-GB")} of ` : ""}
        {total.toLocaleString("en-GB")} {total === 1 ? noun[0] : noun[1]}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="grid size-9 place-items-center rounded-full border border-hairline-strong text-text transition-colors hover:border-text/45 disabled:opacity-30"
          >
            <CaretLeft size={16} weight="light" />
          </button>
          <span className="min-w-[4.5rem] text-center text-meta text-muted">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
            className="grid size-9 place-items-center rounded-full border border-hairline-strong text-text transition-colors hover:border-text/45 disabled:opacity-30"
          >
            <CaretRight size={16} weight="light" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}

const DAY = 86_400_000;

/** "Today, 14:02" · "Yesterday" · "3 days ago" · "12 Mar 2026". */
export function when(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / DAY);
  if (days <= 0) return `Today, ${new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dateOnly(iso);
}

export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const METHOD_LABEL: Record<string, string> = { password: "Email", "google.com": "Google" };
