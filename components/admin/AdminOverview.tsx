"use client";

import Image from "next/image";
import Link from "next/link";
import { BarList, ChartCard, LineChart, StatTile } from "@/components/admin/charts";
import { AdminError, AdminHeader, SectionTitle } from "@/components/admin/parts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminStats } from "@/lib/api/admin";
import { CATEGORY_SINGULAR } from "@/lib/catalog/category";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import type { AdminStats } from "@/lib/admin/types";

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** /admin: who's arriving, what they're saving, and how much of today's budgets is spent. */
export function AdminOverview() {
  const { data, error, refetch, isFetching } = useAdminStats();

  return (
    <div className="max-w-[78rem]">
      <AdminHeader
        eyebrow="Control room"
        title="Overview"
        sub={data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Signed in as an administrator."}
      />
      {error && !data ? (
        <AdminError error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <OverviewSkeleton />
      ) : (
        <div className={cn("transition-opacity duration-300", isFetching && "opacity-70")}>
          <Tiles stats={data} />
          <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ChartCard
              title="Sign-ups"
              sub="New accounts per day, last 30 days"
              table={{ head: ["Day", "Sign-ups"], rows: [...data.signups].reverse().map((d) => [dayLong(d.day), String(d.count)]) }}
            >
              <LineChart
                ariaLabel={`Sign-ups per day over the last 30 days: ${data.users.new30d} in total, ${data.users.newToday} today.`}
                unit={["sign-up", "sign-ups"]}
                endNote="today"
                data={data.signups.map((d, i) => ({
                  label: dayLabel(d.day),
                  sub: i === data.signups.length - 1 ? `Today, ${dayLabel(d.day)}` : dayLong(d.day),
                  value: d.count,
                }))}
              />
            </ChartCard>
            <ChartCard
              title="Genres people save"
              sub="Library items by genre, all users"
              table={{ head: ["Genre", "Items"], rows: data.topGenres.map((g) => [g.genre, String(g.count)]) }}
            >
              {data.topGenres.length ? (
                <BarList
                  unit={["item", "items"]}
                  total={data.library.items}
                  totalLabel="of library items"
                  data={data.topGenres.slice(0, 8).map((g) => ({ label: g.genre, value: g.count }))}
                />
              ) : (
                <p className="text-muted">Nothing saved yet.</p>
              )}
            </ChartCard>
          </div>
          <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <TopTitles rows={data.topTitles} />
            <Usage rows={data.usage} />
          </div>
        </div>
      )}
    </div>
  );
}

function Tiles({ stats }: { stats: AdminStats }) {
  const { users, library } = stats;
  return (
    <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 xl:grid-cols-6">
      <StatTile hero label="Accounts" value={users.total} sub={`${users.new7d.toLocaleString("en-GB")} new this week`} />
      <StatTile label="Active this week" value={users.active7d} />
      <StatTile label="New today" value={users.newToday} />
      <StatTile label="Library items" value={library.items} sub={`${library.watchlist.toLocaleString("en-GB")} on watchlists`} />
      <StatTile label="Blocked" value={users.blocked} sub={users.blocked ? undefined : "None right now"} />
    </div>
  );
}

function TopTitles({ rows }: { rows: AdminStats["topTitles"] }) {
  return (
    <section aria-labelledby="top-titles" className="border-t border-hairline-strong pt-4">
      <SectionTitle id="top-titles" title="Most added" sub="Titles in the most libraries" />
      {rows.length ? (
        <ol className="mt-5 grid gap-x-8 sm:grid-cols-2">
          {rows.map((r, i) => (
            <li key={r.card.key} className="border-b border-hairline">
              <Link href={r.card.href} className="group flex items-center gap-4 py-2.5">
                <span className="w-5 shrink-0 text-right text-meta text-muted tabular-nums">{i + 1}</span>
                <span className="relative aspect-[2/3] w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface">
                  {r.card.posterPath ? <Image src={tmdbImg(r.card.posterPath, "thumb")!} alt="" fill sizes="32px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] group-hover:underline">{r.card.title}</span>
                  <span className="block text-meta text-muted">
                    {CATEGORY_SINGULAR[r.card.category]}
                    {r.card.year ? ` · ${r.card.year}` : ""}
                  </span>
                </span>
                <span className="text-meta text-muted tabular-nums">{r.count}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-muted">Nobody has saved a title yet.</p>
      )}
    </section>
  );
}

/** Today's spend against each daily budget, as meters (status colour only when it's nearly gone). */
function Usage({ rows }: { rows: AdminStats["usage"] }) {
  return (
    <section aria-labelledby="usage" className="border-t border-hairline-strong pt-4">
      <SectionTitle id="usage" title="Today’s usage" sub="Calls to outside services since midnight (UTC)" />
      <ul className="mt-5 space-y-4">
        {rows.map((r) => {
          const share = r.budget ? Math.min(1, r.used / r.budget) : null;
          const high = share != null && share >= 0.85;
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-4 text-[0.9375rem]">
                <span>{r.label}</span>
                <span className="text-meta text-muted tabular-nums">
                  {r.used.toLocaleString("en-GB")}
                  {r.budget ? ` of ${r.budget.toLocaleString("en-GB")}` : ""}
                </span>
              </div>
              {share != null ? (
                <div
                  role="meter"
                  aria-label={`${r.label} budget used`}
                  aria-valuemin={0}
                  aria-valuemax={r.budget!}
                  aria-valuenow={r.used}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-text/[0.08]"
                >
                  <div
                    className={cn("bar-grow h-full rounded-full", high ? "bg-danger" : "bg-accent")}
                    style={{ width: `${Math.max(share * 100, r.used ? 1.5 : 0)}%` }}
                  />
                </div>
              ) : null}
              {high ? <p className="mt-1.5 text-meta text-danger">Nearly at today’s limit</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4 xl:grid-cols-6">
        <Skeleton className="h-24 sm:col-span-2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
