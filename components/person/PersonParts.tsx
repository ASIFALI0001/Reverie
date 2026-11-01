"use client";

import Link from "next/link";
import { useState } from "react";
import { Rail } from "@/components/rails/Rail";
import { PosterCard } from "@/components/title/PosterCard";
import { useQuickScores } from "@/lib/api/match";
import { CATEGORY_LABEL } from "@/lib/catalog/category";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import type { Credit } from "@/lib/person-page";

/** Their best-known work, with the viewer's match on each. */
export function KnownForRail({ credits }: { credits: Credit[] }) {
  const scores = useQuickScores(credits.map((c) => c.key));
  return (
    <Rail label="Known for" heading={<h2 className="font-display text-h2">Known for</h2>}>
      {credits.map((c) => (
        <li key={c.key} className="w-[clamp(8.75rem,38vw,13.75rem)] shrink-0 md:w-[clamp(9.5rem,15vw,13.75rem)]">
          <PosterCard
            href={c.href}
            title={c.title}
            titleKey={c.key}
            posterPath={c.posterPath}
            posterSrc={tmdbImg(c.posterPath)!}
            year={c.year}
            meta={c.role || null}
            match={scores.data?.[c.key] ?? null}
          />
        </li>
      ))}
    </Rail>
  );
}

export function Biography({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = text.split(/\n+/).filter(Boolean);
  const long = text.length > 520;
  return (
    <div>
      <div className={cn("space-y-4 text-[1.0625rem] leading-relaxed text-text/90", long && !open && "line-clamp-6")}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {long ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="link-draw mt-3 text-meta text-muted hover:text-text">
          {open ? "Less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

const SHOW = 24;

/** Everything they've worked on, newest first. */
export function Filmography({ credits }: { credits: Credit[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? credits : credits.slice(0, SHOW);
  return (
    <div>
      <ol className="border-t border-hairline">
        {shown.map((c) => (
          <li key={c.key} className="border-b border-hairline">
            <Link
              href={c.href}
              transitionTypes={["nav-forward"]}
              className="group grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-x-4 py-3 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,16rem)_6rem] md:gap-x-6"
            >
              <span className="numeral text-meta text-muted">{c.year ?? "—"}</span>
              <span className="truncate font-display text-[1.25rem] leading-tight transition-colors group-hover:text-[var(--color-accent)]">
                {c.title}
              </span>
              <span className="col-start-2 truncate text-meta text-muted md:col-start-auto">{c.role}</span>
              <span className="hidden text-right text-meta text-muted md:block">{CATEGORY_LABEL[c.category]}</span>
            </Link>
          </li>
        ))}
      </ol>
      {credits.length > SHOW ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="link-draw mt-5 text-meta text-muted hover:text-text">
          {all ? "Show fewer" : `Show all ${credits.length} credits`}
        </button>
      ) : null}
    </div>
  );
}
