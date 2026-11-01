"use client";

import Image from "next/image";
import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRegionServices } from "@/lib/api/mood";
import { useUpdateMe } from "@/lib/api/me";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { cn } from "@/lib/cn";

const FIRST = 18;

/**
 * My services: the streaming services you have, from those available in your region (most
 * common first). Mood Search can stick to these. Saved as you tap.
 */
export function ServicesPicker({ selected }: { selected: number[] }) {
  const services = useRegionServices();
  const update = useUpdateMe();
  const [showAll, setShowAll] = useState(false);
  const chosen = new Set(selected);

  if (services.isError) return <p className="text-muted">The list of services didn’t load. Refresh to try again.</p>;
  if (!services.data) {
    return (
      <div aria-hidden="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-panel)]" />
        ))}
      </div>
    );
  }
  const all = services.data.services;
  // What you've picked always stays visible, even beyond the first rows.
  const shown = showAll ? all : all.filter((s, i) => i < FIRST || chosen.has(s.id));

  function toggle(id: number, name: string) {
    const next = chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id];
    update.mutate(
      { services: next },
      { onError: (err) => toast({ title: `Couldn’t update ${name}`, description: err instanceof Error ? err.message : undefined, tone: "error" }) },
    );
  }

  return (
    <div>
      <p className="text-meta text-muted">
        In {services.data.region}: {chosen.size ? `${chosen.size} picked` : "none picked yet"}
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((s) => {
          const on = chosen.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.id, s.name)}
                className={cn(
                  "flex h-14 w-full items-center gap-3 rounded-[var(--radius-panel)] border px-3 text-left transition-colors duration-200",
                  on ? "border-text/60 bg-text/[0.05]" : "border-hairline hover:border-hairline-strong",
                )}
              >
                <span className="relative size-8 shrink-0 overflow-hidden rounded-[6px] bg-raised">
                  {s.logoPath ? <Image src={tmdbImg(s.logoPath, "logo")!} alt="" fill sizes="32px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{s.name}</span>
                {on ? <Check size={16} weight="bold" className="shrink-0 text-accent" aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {all.length > FIRST ? (
        <Button variant="ghost" size="sm" className="-ml-4 mt-3" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${all.length}`}
        </Button>
      ) : null}
    </div>
  );
}
