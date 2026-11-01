"use client";

import Link from "next/link";
import { useState } from "react";
import { ToggleGroup } from "radix-ui";
import { AdminError, AdminHeader, Pager, dateTime } from "@/components/admin/parts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminAudit } from "@/lib/api/admin";
import { actionLabel, isModerationAction } from "@/lib/admin/format";
import { cn } from "@/lib/cn";
import type { AuditRow } from "@/lib/admin/types";

function detailLine(row: AuditRow): string | null {
  const d = row.details;
  const parts: string[] = [];
  if (typeof d.reason === "string" && d.reason) parts.push(`“${d.reason}”`);
  if (typeof d.until === "string" && d.until) parts.push(`until ${dateTime(d.until)}`);
  if (d.showReason === true) parts.push("reason shown to them");
  return parts.length ? parts.join(" · ") : null;
}

/** The rows, shared by /admin/audit and a user's Moderation tab. */
export function AuditRows({ rows, showTarget = true }: { rows: AuditRow[]; showTarget?: boolean }) {
  if (!rows.length) return <p className="border-t border-hairline pt-4 text-muted">Nothing recorded yet.</p>;
  return (
    <ol className="border-t border-hairline">
      {rows.map((r) => {
        const detail = detailLine(r);
        return (
          <li key={r.id} className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-hairline py-3 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
            <time dateTime={r.at} className="text-meta text-muted tabular-nums">
              {dateTime(r.at)}
            </time>
            <div className="min-w-0 text-[0.9375rem]">
              <p>
                <span className={cn(isModerationAction(r.action) && "text-accent")}>{actionLabel(r.action)}</span>
                {showTarget && r.target ? (
                  <>
                    {" "}
                    <span className="text-muted">·</span>{" "}
                    <Link href={`/admin/users/${encodeURIComponent(r.target.uid)}`} className="hover:underline">
                      {r.target.name}
                    </Link>
                    {r.target.handle ? <span className="text-meta text-muted"> @{r.target.handle}</span> : null}
                  </>
                ) : null}
              </p>
              <p className="text-meta text-muted">
                by {r.admin.name}
                {r.ip ? ` · ${r.ip}` : ""}
              </p>
              {detail ? <p className="mt-0.5 text-meta text-text/80">{detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const FILTERS = [
  { value: "", label: "Everything" },
  { value: "user.block,user.unblock", label: "Blocks" },
  { value: "user.view*", label: "Views" },
  { value: "admin.*", label: "Admin roles" },
] as const;

/** /admin/audit: every look at a user's data and every action, newest first. */
export function AuditLog() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("");
  const [page, setPage] = useState(1);
  const { data, error, refetch, isFetching, isPlaceholderData } = useAdminAudit({ action: filter || undefined, page });

  return (
    <div className="max-w-[60rem]">
      <AdminHeader eyebrow="Control room" title="Audit log" sub="Kept for good. Admins can read it but never edit it." />
      <ToggleGroup.Root
        type="single"
        value={filter}
        onValueChange={(v) => {
          setFilter((v ?? "") as typeof filter);
          setPage(1);
        }}
        aria-label="Show"
        className="mt-8 flex w-fit flex-wrap rounded-full border border-hairline-strong p-1"
      >
        {FILTERS.map((f) => (
          <ToggleGroup.Item
            key={f.value}
            value={f.value}
            className={cn("h-8 rounded-full px-3.5 text-[0.875rem] transition-colors duration-200", filter === f.value ? "bg-text text-bg" : "text-muted hover:text-text")}
          >
            {f.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className={cn("mt-8 transition-opacity duration-300", isFetching && isPlaceholderData && "opacity-60")}>
        {error && !data ? (
          <AdminError error={error} onRetry={() => void refetch()} />
        ) : data ? (
          <>
            <AuditRows rows={data.rows} />
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun={["entry", "entries"]} />
          </>
        ) : (
          <div aria-hidden="true" className="space-y-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
