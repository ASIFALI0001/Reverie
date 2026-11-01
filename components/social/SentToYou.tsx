"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Rail } from "@/components/rails/Rail";
import { SentCard } from "@/components/social/SentCard";
import { useInbox } from "@/lib/api/social";
import { api } from "@/lib/api/client";

/** Home: "Sent to you", newest first, only when friends have sent something you haven't answered. */
export function SentToYouRail() {
  const { data } = useInbox();
  const open = data?.items.filter((i) => !i.reaction) ?? [];
  if (!open.length) return null;
  const heading = (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      <h2 className="font-display text-h3">Sent to you</h2>
      <Link href="/library/sent" className="link-draw text-meta text-muted hover:text-text">
        See all
      </Link>
    </div>
  );
  return (
    <section className="py-[calc(var(--section-y)*0.4)]">
      <Rail label="Sent to you" heading={heading}>
        {open.slice(0, 10).map((item) => (
          <li key={item.id} className="w-[min(21rem,82vw)] shrink-0">
            <SentCard item={item} />
          </li>
        ))}
      </Rail>
    </section>
  );
}

/** Library → Sent to you: everything friends sent, answered or not. Opening it marks them seen. */
export function SentInbox() {
  const { data, error, refetch } = useInbox();
  const unseen = data?.items.filter((i) => !i.seen).length ?? 0;
  useEffect(() => {
    if (unseen) void api("/api/recommendations/seen", { method: "POST" }).catch(() => {});
  }, [unseen]);

  if (error && !data) {
    return (
      <div className="max-w-xl">
        <p className="text-text">This didn’t load.</p>
        <Button className="mt-4" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div aria-hidden="true" className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-[var(--radius-panel)]" />
        ))}
      </div>
    );
  }
  if (!data.items.length) {
    return (
      <div className="max-w-xl border-t border-hairline pt-6">
        <PaperPlaneTilt size={28} weight="light" className="text-muted" aria-hidden="true" />
        <p className="mt-4 font-display text-h3">Nothing sent to you yet.</p>
        <p className="mt-3 text-muted">When a friend sends you a title, it lands here with their note and your own match for it.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/friends">Go to Friends</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {data.items.map((item) => (
        <li key={item.id}>
          <SentCard item={item} />
        </li>
      ))}
    </ul>
  );
}
