"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useWhyNot, useWhyNotFeedback } from "@/lib/api/match";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { MediaType } from "@/lib/catalog/types";

/** Below this match, the title page explains why it might not be for you (brief §2). */
export const WHY_NOT_BELOW = 70;
/** Lists offer a small "Why?" only on clearly low matches. */
export const WHY_LINK_BELOW = 55;

/**
 * "Why it might not be for you": two or three honest reasons, each resting on titles from your
 * own history (their posters are the evidence), then one thing you might still enjoy, and
 * "Was this right?". Until it loads, or if it can't, the match's own reasons stand in.
 */
export function WhyNot({ mediaType, tmdbId, fallbackReasons }: { mediaType: MediaType; tmdbId: number; fallbackReasons: string[] }) {
  const reduced = useReducedMotion();
  const why = useWhyNot(mediaType, tmdbId, { enabled: true });
  const feedback = useWhyNotFeedback(mediaType, tmdbId);
  const d = why.data?.status === "ok" ? why.data : null;

  const rise = (i: number) => ({
    variants: { hidden: reduced ? { opacity: 0 } : { y: "105%" }, shown: reduced ? { opacity: 1 } : { y: 0 } },
    transition: { duration: 0.85, ease: ease.out, delay: 0.1 + i * 0.09 },
  });
  // Nothing in their history against it (no close misses, no mismatches): the match's own reasons stand.
  const own = Boolean(d?.negatives.length);
  const lines = own ? d!.negatives.map((n) => n.reason) : fallbackReasons;

  return (
    <>
      <h2 id="your-match" className="mt-3 overflow-hidden text-h2">
        <motion.span className="block" {...rise(0)}>
          Why it might not be for <em>you</em>
        </motion.span>
      </h2>

      {why.isPending ? (
        <div aria-busy="true" className="mt-8 border-t border-hairline pt-5">
          <p className="text-muted">Looking through what you’ve watched…</p>
          <div className="relative mt-4 h-px w-full max-w-md overflow-hidden bg-hairline-strong">
            <span className="beam" />
          </div>
        </div>
      ) : (
        <ul className="mt-8 border-t border-hairline">
          {lines.map((line, i) => {
            const evidence = own ? (d?.negatives[i]?.evidence ?? []) : [];
            return (
              <li key={line} className="border-b border-hairline py-4">
                <div className="overflow-hidden">
                  <motion.p className="font-display text-[clamp(1.25rem,2vw,1.625rem)] leading-snug" {...rise(i + 1)}>
                    {line}
                  </motion.p>
                </div>
                {evidence.length ? (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="caption">Based on</span>
                    <ul className="flex gap-2">
                      {evidence.map((e) => (
                        <li key={e.key}>
                          <Link href={e.href} title={e.title} aria-label={`Based on ${e.title}`} className="group relative block aspect-[2/3] w-9 overflow-hidden rounded-[2px] bg-surface">
                            {e.posterPath ? (
                              <Image src={tmdbImg(e.posterPath, "thumb")!} alt="" fill sizes="36px" className="object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <span className="min-w-0 truncate text-meta text-muted">{evidence.map((e) => e.title).join(", ")}</span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {d?.positive ? (
        <div className="mt-8 grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
          <p className="caption pt-1">But you might still enjoy…</p>
          <p className="max-w-[54ch] text-[1.0625rem] text-text/90">{d.positive}</p>
        </div>
      ) : null}

      {d ? (
        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p id="why-not-right" className="text-meta text-muted">
            Was this right?
          </p>
          <div role="group" aria-labelledby="why-not-right" className="flex gap-1.5">
            {(
              [
                [true, ThumbsUp, "Yes, that sounds like me"],
                [false, ThumbsDown, "No, I think I’d like it"],
              ] as const
            ).map(([helpful, Icon, label]) => {
              const on = d.feedback === helpful;
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  aria-pressed={on}
                  title={label}
                  disabled={feedback.isPending}
                  onClick={() =>
                    feedback.mutate(helpful, {
                      onError: (err) => toast({ title: "Couldn’t save that", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                    })
                  }
                  className={cn(
                    "grid size-9 place-items-center rounded-full border transition-colors duration-200 disabled:opacity-50",
                    on ? "border-text bg-text text-bg" : "border-hairline-strong text-muted hover:border-text/45 hover:text-text",
                  )}
                >
                  <Icon size={16} weight={on ? "fill" : "light"} />
                </button>
              );
            })}
          </div>
          <p role="status" className="text-meta text-muted">
            {d.feedback == null ? "" : d.feedback ? "Thanks. Reverie will count that, lightly." : "Noted. Reverie will lean a little your way."}
          </p>
        </div>
      ) : null}
    </>
  );
}
