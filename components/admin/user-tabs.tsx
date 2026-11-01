"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import { EyeSlash, LockOpen, Prohibit } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { TasteDnaCard } from "@/components/taste/TasteDnaCard";
import { AdminError, METHOD_LABEL, Pager, PersonLink, SectionTitle, dateOnly, dateTime, when } from "@/components/admin/parts";
import { AuditRows } from "@/components/admin/AuditLog";
import { useAdminUserTab } from "@/lib/api/admin";
import { CATEGORY_LABEL, CATEGORY_SINGULAR } from "@/lib/catalog/category";
import { shelfName } from "@/lib/library/shelves";
import { reactionLabels } from "@/lib/library/reactions";
import { chipById } from "@/lib/taste/chips";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import type { Category } from "@/lib/catalog/types";
import type { LibraryEntry, LibraryOverview, WatchlistEntry } from "@/lib/library/service";
import type { AdminUserActivity, AdminUserFriends, AdminUserProfile, AdminUserTaste, AuditPage } from "@/lib/admin/types";

/** The panels of /admin/users/[uid]. Each one fetches (and is audited) the first time it opens. */

// ── Shared bits ─────────────────────────────────────────────────────────────

function Facts({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <section>
      <h2 className="caption font-sans">{title}</h2>
      <dl className="mt-3 border-t border-hairline">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-4 border-b border-hairline py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <dt className="text-meta text-muted">{k}</dt>
            <dd className="min-w-0 break-words text-[0.9375rem]">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TabState({ error, onRetry, rows = 4 }: { error: unknown; onRetry: () => void; rows?: number }) {
  if (error) return <AdminError error={error} onRetry={onRetry} />;
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="border-t border-hairline pt-4 text-muted">{children}</p>;
}

function Poster({ path, size = 32 }: { path: string | null; size?: number }) {
  return (
    <span className="relative aspect-[2/3] shrink-0 overflow-hidden rounded-[2px] bg-surface" style={{ width: size }}>
      {path ? <Image src={tmdbImg(path, "thumb")!} alt="" fill sizes={`${size}px`} className="object-cover" /> : null}
    </span>
  );
}

function Hidden() {
  return (
    <span className="inline-flex items-center gap-1.5 text-meta text-muted" title="Hidden from friends">
      <EyeSlash size={14} weight="light" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Hidden from friends</span>
    </span>
  );
}

const stars = (rating: number | null) => (rating ? `★ ${rating / 2}` : "—");
const yesNo = (v: boolean, yes: string, no: string) => (v ? yes : no);

// ── Profile ─────────────────────────────────────────────────────────────────

const FRIENDS_SEE = { everything: "Everything", ratings: "Ratings only", nothing: "Nothing" } as const;
const PROVIDER_LABEL: Record<string, string> = { password: "Email and password", "google.com": "Google" };

export function ProfileTab({ user }: { user: AdminUserProfile }) {
  const fb = user.firebase;
  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-2">
      <Facts
        title="Account"
        rows={[
          ["User ID", <code key="id" className="font-mono text-meta">{user.uid}</code>],
          ["Email", user.email ? `${user.email}${fb ? (fb.emailVerified ? " · verified" : " · not verified") : ""}` : "—"],
          ["Signs in with", fb?.providers.length ? fb.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(", ") : "—"],
          ["Signed up with", user.signUpMethod ? (METHOD_LABEL[user.signUpMethod] ?? user.signUpMethod) : "—"],
          ["Joined", dateTime(user.createdAt)],
          ["Last active", dateTime(user.lastActiveAt)],
          ["Last sign-in", dateTime(fb?.lastSignInAt)],
          ["Handle", user.handle ? `@${user.handle}${user.handleChosen ? "" : " (suggested, not chosen yet)"}` : "None yet"],
          ["Onboarding", yesNo(user.onboardingDone, "Finished", "Not finished")],
          ["Region", user.region],
          ["Languages", user.languages.length ? user.languages.join(", ") : "—"],
          ...(fb?.disabled ? ([["Firebase", "Disabled in Firebase"]] as [string, ReactNode][]) : []),
        ]}
      />
      <div className="space-y-12">
        <Facts
          title="Privacy"
          rows={[
            ["Friends can see", FRIENDS_SEE[user.privacy.friendsSee]],
            ["Taste Twins", yesNo(user.privacy.inTwins, "Included", "Opted out")],
            ["Search", yesNo(user.privacy.searchable, "Can be found", "Hidden from search")],
          ]}
        />
        <Facts
          title="Streaming"
          rows={[["My services", user.services.length ? `${user.services.length} chosen` : "None chosen"]]}
        />
      </div>
    </div>
  );
}

// ── Taste DNA ───────────────────────────────────────────────────────────────

const pct = (v: number | null) => (v == null ? "Not set" : `${Math.round(v * 100)}`);

export function TasteTab({ uid, enabled }: { uid: string; enabled: boolean }) {
  const { data, error, refetch } = useAdminUserTab<AdminUserTaste>(uid, "taste", enabled);
  if (!data) return <TabState error={error} onRetry={() => void refetch()} />;
  const a = data.answers;
  return (
    <div className="space-y-14">
      {data.view.status === "ready" ? (
        <TasteDnaCard view={data.view} compact animate={false} label="Their Taste DNA" />
      ) : (
        <Empty>No taste profile yet. It’s built after onboarding, or once they rate a few titles.</Empty>
      )}
      <div className="grid grid-cols-1 gap-12 xl:grid-cols-2">
        <Facts
          title="Profile"
          rows={[
            ["Signals", data.signalCount.toLocaleString("en-GB")],
            ["Version", String(data.version)],
            ["Built", dateTime(data.builtAt)],
            ["Summary by", data.summarySource === "gemini" ? "AI" : data.summarySource === "fallback" ? "Template (AI unavailable)" : "—"],
          ]}
        />
        {a ? (
          <Facts
            title="Onboarding answers"
            rows={[
              ["Formats", a.formats.length ? a.formats.map((f) => CATEGORY_LABEL[f]).join(", ") : "—"],
              ["Picked", a.genres.length ? a.genres.map((g) => chipById(g)?.label ?? g).join(", ") : "—"],
              ["Pace · tone · depth", `${pct(a.pace)} · ${pct(a.tone)} · ${pct(a.complexity)}`],
              ["Era", a.era == null ? "Not set" : a.era < 0.35 ? "New releases" : a.era > 0.65 ? "Classics" : "Any"],
              ["Endings", a.endings ?? "Not set"],
              ["Subtitles", a.subtitles == null ? "Not set" : yesNo(a.subtitles, "Fine", "Prefers not")],
            ]}
          />
        ) : null}
      </div>
      <section aria-labelledby="snapshots">
        <SectionTitle id="snapshots" title="Month by month" sub="Snapshots behind the taste timeline" />
        {data.snapshots.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline-strong">
                  {["Month", "Titles", "Hours", "Avg rating", "Top genres"].map((h, i) => (
                    <th key={h} scope="col" className={cn("caption py-2.5 pr-6 font-normal", i > 0 && i < 4 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.snapshots].reverse().map((s) => (
                  <tr key={s.month} className="border-b border-hairline">
                    <td className="py-2.5 pr-6 text-[0.9375rem]">
                      {new Date(`${s.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
                    </td>
                    <td className="py-2.5 pr-6 text-right text-meta tabular-nums">{s.count}</td>
                    <td className="py-2.5 pr-6 text-right text-meta tabular-nums">{Math.round(s.hours)}</td>
                    <td className="py-2.5 pr-6 text-right text-meta tabular-nums">{s.avgRating == null ? "—" : `★ ${(s.avgRating / 2).toFixed(1)}`}</td>
                    <td className="py-2.5 pr-6 text-meta text-muted">{s.topGenres.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5">
            <Empty>No monthly snapshots yet.</Empty>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Library (shelved as they see it) ────────────────────────────────────────

const STATUS = { watched: "Watched", watching: "Watching", dropped: "Dropped" } as const;
const CATEGORIES: Category[] = ["movie", "series", "anime", "cartoon"];

export function LibraryTab({ uid, enabled }: { uid: string; enabled: boolean }) {
  const { data, error, refetch } = useAdminUserTab<{ overview: LibraryOverview; entries: LibraryEntry[] }>(uid, "library", enabled);
  const [category, setCategory] = useState<Category | null>(null);
  const [shelf, setShelf] = useState<string | null>(null);
  if (!data) return <TabState error={error} onRetry={() => void refetch()} rows={6} />;

  const { overview, entries } = data;
  if (!entries.length) return <Empty>Their library is empty.</Empty>;
  const cat = category ?? CATEGORIES.find((c) => overview.categories[c] > 0) ?? "movie";
  const shelves = Object.entries(overview.shelves[cat] ?? {}).sort((a, b) => b[1] - a[1]);
  const custom = overview.custom.filter((s) => s.count > 0);
  const inCategory = entries.filter((e) => e.card.category === cat);
  const shown = shelf
    ? shelf.startsWith("custom:")
      ? entries.filter((e) => e.customShelves.includes(shelf.slice(7)))
      : inCategory.filter((e) => e.shelves.includes(shelf))
    : inCategory;
  const { stats } = overview;

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {[
          ["Titles", overview.total.toLocaleString("en-GB")],
          ["Hours watched", Math.round(stats.hoursWatched).toLocaleString("en-GB")],
          ["Rated", stats.rated.toLocaleString("en-GB")],
          ["Average rating", stats.averageRating == null ? "—" : `★ ${(stats.averageRating / 2).toFixed(1)}`],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-hairline-strong pt-3">
            <dt className="text-meta text-muted">{k}</dt>
            <dd className="mt-1.5 text-[1.5rem] font-semibold leading-none tracking-[-0.01em]">{v}</dd>
          </div>
        ))}
      </dl>

      <ToggleGroup.Root
        type="single"
        value={cat}
        onValueChange={(v) => {
          if (!v) return;
          setCategory(v as Category);
          setShelf(null);
        }}
        aria-label="Format"
        className="mt-10 flex w-fit max-w-full overflow-x-auto rounded-full border border-hairline-strong p-1 [scrollbar-width:none]"
      >
        {CATEGORIES.map((c) => (
          <ToggleGroup.Item
            key={c}
            value={c}
            disabled={!overview.categories[c]}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2 rounded-full px-3.5 text-[0.875rem] transition-colors duration-200 disabled:opacity-35",
              cat === c ? "bg-text text-bg" : "text-muted hover:text-text",
            )}
          >
            {CATEGORY_LABEL[c]}
            <span className={cn("numeral text-[0.75rem]", cat === c ? "text-bg/70" : "text-muted")}>{overview.categories[c]}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Shelves">
        <Chip selected={shelf == null} onToggle={() => setShelf(null)} count={inCategory.length}>
          All {CATEGORY_LABEL[cat].toLowerCase()}
        </Chip>
        {shelves.map(([slug, n]) => (
          <Chip key={slug} selected={shelf === slug} onToggle={(on) => setShelf(on ? slug : null)} count={n}>
            {shelfName(slug, overview.collectionNames)}
          </Chip>
        ))}
        {custom.map((s) => (
          <Chip key={s.id} selected={shelf === `custom:${s.id}`} onToggle={(on) => setShelf(on ? `custom:${s.id}` : null)} count={s.count}>
            {s.name}
          </Chip>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline-strong">
              {["Title", "Status", "Rating", "What they said", "Watched"].map((h, i) => (
                <th key={h} scope="col" className={cn("caption py-2.5 pr-6 font-normal", i === 2 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => {
              const worked = reactionLabels(e.worked);
              const didnt = reactionLabels(e.didnt);
              return (
                <tr key={e.key} className="border-b border-hairline align-top">
                  <td className="py-2.5 pr-6">
                    <Link href={e.card.href} className="group flex items-center gap-3">
                      <Poster path={e.card.posterPath} />
                      <span className="min-w-0">
                        <span className="block max-w-[16rem] truncate text-[0.9375rem] group-hover:underline">{e.card.title}</span>
                        <span className="flex items-center gap-2 text-meta text-muted">
                          {e.card.year ?? "—"}
                          {e.hiddenFromFriends ? <Hidden /> : null}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-6 text-meta">
                    {STATUS[e.status]}
                    {e.progress ? <span className="block text-muted">S{e.progress.season} · E{e.progress.episode}</span> : null}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-6 text-right text-meta tabular-nums">{stars(e.rating)}</td>
                  <td className="max-w-[22rem] py-2.5 pr-6 text-meta">
                    {worked.length ? <span className="block text-muted">Worked: {worked.join(", ")}</span> : null}
                    {didnt.length ? <span className="block text-muted">Didn’t work: {didnt.join(", ")}</span> : null}
                    {e.note ? (
                      <span className="mt-0.5 line-clamp-2 block text-text" title={e.note}>
                        “{e.note}”
                      </span>
                    ) : null}
                    {!worked.length && !didnt.length && !e.note ? <span className="text-faint">—</span> : null}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-6 text-meta text-muted">{dateOnly(e.watchedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Watchlist ───────────────────────────────────────────────────────────────

export function WatchlistTab({ uid, enabled }: { uid: string; enabled: boolean }) {
  const { data, error, refetch } = useAdminUserTab<{ items: WatchlistEntry[] }>(uid, "watchlist", enabled);
  if (!data) return <TabState error={error} onRetry={() => void refetch()} />;
  if (!data.items.length) return <Empty>Nothing on their watchlist.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline-strong">
            {["Title", "Format", "Their match", "Added"].map((h, i) => (
              <th key={h} scope="col" className={cn("caption py-2.5 pr-6 font-normal", i === 2 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((w) => (
            <tr key={w.key} className="border-b border-hairline">
              <td className="py-2.5 pr-6">
                <Link href={w.card.href} className="group flex items-center gap-3">
                  <Poster path={w.card.posterPath} />
                  <span className="min-w-0">
                    <span className="block max-w-[18rem] truncate text-[0.9375rem] group-hover:underline">{w.card.title}</span>
                    <span className="flex items-center gap-2 text-meta text-muted">
                      {w.card.year ?? "—"}
                      {w.hiddenFromFriends ? <Hidden /> : null}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="py-2.5 pr-6 text-meta text-muted">{CATEGORY_SINGULAR[w.card.category]}</td>
              <td className="py-2.5 pr-6 text-right text-meta tabular-nums">{w.match == null ? "—" : `${w.match}%`}</td>
              <td className="whitespace-nowrap py-2.5 pr-6 text-meta text-muted">{dateOnly(w.addedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Friends ─────────────────────────────────────────────────────────────────

function People({ title, rows, empty }: { title: string; rows: { key: string; node: ReactNode }[]; empty: string }) {
  return (
    <section>
      <h2 className="caption font-sans">
        {title} <span className="numeral text-[0.75rem]">{rows.length}</span>
      </h2>
      {rows.length ? (
        <ul className="mt-3 border-t border-hairline">
          {rows.map((r) => (
            <li key={r.key} className="border-b border-hairline py-2.5">
              {r.node}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-hairline pt-3 text-meta text-muted">{empty}</p>
      )}
    </section>
  );
}

const REACTION = { watchlisted: "Added it to their watchlist", watched: "Watched it", "not-for-me": "Not for them" } as const;

export function FriendsTab({ uid, enabled }: { uid: string; enabled: boolean }) {
  const { data, error, refetch } = useAdminUserTab<AdminUserFriends>(uid, "friends", enabled);
  if (!data) return <TabState error={error} onRetry={() => void refetch()} />;
  const person = (p: AdminUserFriends["friends"][number]["person"], sub: string) => ({ key: p.uid, node: <PersonLink person={p} sub={sub} /> });
  const rec = (r: AdminUserFriends["sent"][number], dir: "to" | "from") => ({
    key: `${r.person.uid}-${r.title.key}-${r.at}`,
    node: (
      <div className="flex items-start gap-3">
        <Poster path={r.title.posterPath} size={28} />
        <div className="min-w-0 text-[0.9375rem]">
          <p className="truncate">
            {r.title.title} <span className="text-muted">{dir === "to" ? "to" : "from"}</span>{" "}
            <Link href={`/admin/users/${encodeURIComponent(r.person.uid)}`} className="hover:underline">
              {r.person.name}
            </Link>
          </p>
          <p className="text-meta text-muted">
            {when(r.at)}
            {r.reaction ? ` · ${REACTION[r.reaction as keyof typeof REACTION] ?? r.reaction}` : ""}
          </p>
          {r.note ? <p className="mt-0.5 text-meta">“{r.note}”</p> : null}
        </div>
      </div>
    ),
  });
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-12 xl:grid-cols-2">
      <People title="Friends" rows={data.friends.map((f) => person(f.person, `since ${dateOnly(f.since)}`))} empty="No friends yet." />
      <div className="space-y-12">
        <People title="Requests received" rows={data.requestsIn.map((r) => person(r.person, when(r.at)))} empty="None waiting." />
        <People title="Requests sent" rows={data.requestsOut.map((r) => person(r.person, when(r.at)))} empty="None pending." />
      </div>
      <People title="They blocked" rows={data.blocked.map((b) => person(b.person, dateOnly(b.at)))} empty="Nobody." />
      <People title="Blocked them" rows={data.blockedBy.map((b) => person(b.person, dateOnly(b.at)))} empty="Nobody." />
      <People
        title="Shared lists"
        rows={data.sharedLists.map((l) => ({
          key: l.id,
          node: (
            <div className="text-[0.9375rem]">
              <p>
                {l.name} <span className="text-meta text-muted">· {l.owner ? "owner" : "member"} · {l.items} titles</span>
              </p>
              <p className="text-meta text-muted">With {l.members.map((m) => m.name).join(", ") || "nobody else"}</p>
            </div>
          ),
        }))}
        empty="No shared lists."
      />
      <div className="space-y-12">
        <People title="Sent to friends" rows={data.sent.map((r) => rec(r, "to"))} empty="Nothing sent." />
        <People title="Sent to them" rows={data.received.map((r) => rec(r, "from"))} empty="Nothing received." />
      </div>
    </div>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

const VERB = { watched: "Watched", rated: "Rated", started: "Started", watchlisted: "Saved for later" } as const;
const TIME = { short: "Under an hour", film: "A film’s length", long: "A long one", binge: "A binge" } as const;

export function ActivityTab({ uid, enabled }: { uid: string; enabled: boolean }) {
  const { data, error, refetch } = useAdminUserTab<AdminUserActivity>(uid, "activity", enabled);
  if (!data) return <TabState error={error} onRetry={() => void refetch()} />;
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-12 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <People
        title="Recent activity"
        empty="Nothing in the last 90 days."
        rows={data.activity.map((a, i) => ({
          key: `${a.title.key}-${a.at}-${i}`,
          node: (
            <div className="flex items-center gap-3">
              <Poster path={a.title.posterPath} size={28} />
              <p className="min-w-0 flex-1 truncate text-[0.9375rem]">
                <span className="text-muted">{VERB[a.type as keyof typeof VERB] ?? a.type}</span> {a.title.title}
                {a.rating ? <span className="text-muted"> · {stars(a.rating)}</span> : null}
              </p>
              <span className="shrink-0 text-meta text-muted">{when(a.at)}</span>
            </div>
          ),
        }))}
      />
      <div className="space-y-12">
        <People
          title="Mood searches"
          empty="None yet."
          rows={data.moods.map((m, i) => ({
            key: `${m.at}-${i}`,
            node: (
              <div className="text-[0.9375rem]">
                <p>
                  {m.mood} <span className="text-meta text-muted">· {TIME[m.time as keyof typeof TIME] ?? m.time}{m.company ? ` · ${m.company}` : ""}</span>
                </p>
                <p className="text-meta text-muted">
                  {when(m.at)} · {m.chosen ? `Picked ${m.chosen}` : m.picks.length ? `Shown ${m.picks.join(", ")}` : "No picks"}
                </p>
              </div>
            ),
          }))}
        />
        <People
          title="Recent searches"
          empty="None yet."
          rows={data.searches.map((s, i) => ({
            key: `${s.at}-${i}`,
            node: (
              <p className="flex items-baseline justify-between gap-4 text-[0.9375rem]">
                <span className="min-w-0 truncate">{s.query}</span>
                <span className="shrink-0 text-meta text-muted">{when(s.at)}</span>
              </p>
            ),
          }))}
        />
      </div>
    </div>
  );
}

// ── Moderation: block state, history, and what admins did here ─────────────

export function AdminTabPanel({
  user,
  enabled,
  onModerate,
}: {
  user: AdminUserProfile;
  enabled: boolean;
  onModerate: (mode: "block" | "unblock") => void;
}) {
  const [page, setPage] = useState(1);
  const { data, error, refetch, isFetching, isPlaceholderData } = useAdminUserTab<AuditPage>(user.uid, "audit", enabled, page);
  const admin = user.role === "admin" || user.firebase?.admin === true;

  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-12">
        <section>
          <h2 className="caption font-sans">Status</h2>
          <div className="mt-3 border-t border-hairline pt-4">
            {admin ? (
              <p className="text-meta text-muted">Administrators can’t be blocked from the panel. Revoke the role first (npm run make-admin -- email --revoke).</p>
            ) : user.status === "blocked" ? (
              <Button variant="secondary" size="sm" onClick={() => onModerate("unblock")}>
                <LockOpen size={16} weight="light" aria-hidden="true" /> Unblock…
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => onModerate("block")}>
                <Prohibit size={16} weight="light" aria-hidden="true" /> Block…
              </Button>
            )}
          </div>
        </section>
        <People
          title="Block history"
          empty="Never blocked."
          rows={user.blockHistory.map((h, i) => ({
            key: `${h.at}-${i}`,
            node: (
              <div className="text-[0.9375rem]">
                <p>
                  {h.action === "block" ? "Blocked" : "Unblocked"}
                  <span className="text-meta text-muted">
                    {" "}
                    · {dateTime(h.at)} · by {h.by}
                    {h.until ? ` · until ${dateOnly(h.until)}` : ""}
                  </span>
                </p>
                {h.reason ? <p className="text-meta text-muted">“{h.reason}”</p> : null}
              </div>
            ),
          }))}
        />
      </div>
      <section aria-labelledby="user-audit">
        <SectionTitle id="user-audit" title="Admin activity on this account" sub="Every view and action, newest first" />
        <div className={cn("mt-5 transition-opacity duration-300", isFetching && isPlaceholderData && "opacity-60")}>
          {data ? (
            <>
              <AuditRows rows={data.rows} showTarget={false} />
              <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun={["entry", "entries"]} />
            </>
          ) : (
            <TabState error={error} onRetry={() => void refetch()} />
          )}
        </div>
      </section>
    </div>
  );
}
