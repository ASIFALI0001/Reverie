"use client";

import Link from "next/link";
import { useState } from "react";
import { Popover } from "radix-ui";
import { useWhyNot } from "@/lib/api/match";
import { cn } from "@/lib/cn";
import type { MediaType } from "@/lib/catalog/types";

/**
 * A quiet "Why?" on low-match cards in lists: the top reason in a small popover, loaded only
 * when opened, and never waiting for the model (lists stay quick; the title page has the rest).
 */
export function WhyPopover({ mediaType, tmdbId, title, href, className }: { mediaType: MediaType; tmdbId: number; title: string; href: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const why = useWhyNot(mediaType, tmdbId, { enabled: open, quick: true });
  const top = why.data?.status === "ok" ? why.data.negatives[0] : null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Why might ${title} not be for you?`}
        className={cn("text-meta text-muted underline decoration-hairline-strong underline-offset-4 transition-colors hover:text-text hover:decoration-text/50", className)}
      >
        Why?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="menu-anim z-[70] w-[min(19rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-4"
        >
          {why.isPending ? (
            <div aria-busy="true">
              <p className="text-meta text-muted">Checking your history…</p>
              <div className="relative mt-3 h-px w-full overflow-hidden bg-hairline-strong">
                <span className="beam" />
              </div>
            </div>
          ) : top ? (
            <>
              <p className="font-display text-[1.1875rem] leading-snug">{top.reason}</p>
              {top.evidence.length ? <p className="mt-2 text-meta text-muted">Based on {top.evidence.map((e) => e.title).join(", ")}</p> : null}
            </>
          ) : (
            <p className="text-[0.9375rem] text-muted">Nothing in your history clearly against it: it’s more that little points toward it.</p>
          )}
          <Link href={`${href}#your-match`} onClick={() => setOpen(false)} className="link-draw mt-3 inline-block text-meta text-text">
            The full picture
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
