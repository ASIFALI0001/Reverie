"use client";

import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { useFriendsActivity, type ActivityItem } from "@/lib/api/social";
import { tmdbImg } from "@/lib/images/tmdb";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

const VERB: Record<ActivityItem["type"], string> = { watched: "watched", rated: "rated", started: "started", watchlisted: "saved" };

/** "Aman watched Dark · rated 10": the words of one activity line. */
export function activityLine(a: ActivityItem) {
  const first = a.person.name.split(" ")[0];
  const rating = a.rating != null && (a.type === "watched" || a.type === "rated") ? ` · ${a.rating}/10` : "";
  return { who: first, verb: VERB[a.type], title: a.card.title, rest: rating };
}

function Line({ a, compact }: { a: ActivityItem; compact: boolean }) {
  const l = activityLine(a);
  return (
    <div className={cn("flex items-center gap-3", compact ? "py-0" : "py-3")}>
      <Avatar name={a.person.name} photoURL={a.person.photoURL} avatar={a.person.avatar} size={compact ? 28 : 34} />
      <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
        <span className="text-text">{l.who}</span> <span className="text-muted">{l.verb}</span>{" "}
        <Link href={a.card.href} className="text-text hover:underline">
          {l.title}
        </Link>
        <span className="text-muted">{l.rest}</span>
        <span className="block text-meta text-muted">{timeAgo(a.at)}</span>
      </p>
      <Link href={a.card.href} tabIndex={-1} aria-hidden="true" className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-[2px] bg-surface">
        {a.card.posterPath ? <Image src={tmdbImg(a.card.posterPath, "thumb")!} alt="" fill sizes="36px" className="object-cover" /> : null}
      </Link>
    </div>
  );
}

/** The friends page: what friends watched, rated and saved lately (as far as each of them shares). */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-10 border-t border-hairline lg:grid-cols-2">
      {items.map((a) => (
        <li key={a.id} className="border-b border-hairline">
          <Line a={a} compact={false} />
        </li>
      ))}
    </ul>
  );
}

/** Home: a quiet row of the latest few, only when there's something to show. */
export function FriendsLately() {
  const { data } = useFriendsActivity();
  const items = data?.items ?? [];
  if (!items.length) return null;
  return (
    <section aria-labelledby="friends-lately" className="page py-[calc(var(--section-y)*0.4)]">
      <div className="flex items-baseline gap-5">
        <h2 id="friends-lately" className="font-display text-h3">
          Friends lately
        </h2>
        <Link href="/friends" className="link-draw text-meta text-muted hover:text-text">
          Friends
        </Link>
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-4 border-t border-hairline pt-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 6).map((a) => (
          <li key={a.id}>
            <Line a={a} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
