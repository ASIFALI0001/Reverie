"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RiseHeading } from "@/components/motion/RiseHeading";
import { MatchMini } from "@/components/title/MatchRing";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsk, useRecentSearches, type AskState } from "@/lib/api/ask";
import { useQueryParam } from "@/lib/hooks/use-query-param";
import { tmdbImg } from "@/lib/images/tmdb";
import { cardMeta } from "@/lib/catalog/cards";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { AskItem } from "@/lib/search/types";
import { WhyPopover } from "@/components/title/WhyPopover";
import { WHY_LINK_BELOW } from "@/components/title/WhyNot";

const EXAMPLES = [
  "A movie like Jurassic World but scarier",
  "Mind-bending sci-fi with a twist ending, not too long",
  "Anime like Death Note",
  "Feel-good series for a rainy weekend",
];

export function SearchView() {
  const initial = useQueryParam("q");
  const { status: auth } = useAuth();
  const { state, run, reset } = useAsk();
  const recent = useRecentSearches();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const started = useRef<string | null>(null);

  // A shared /search?q=… link runs straight away (once auth has settled, so results carry your match).
  useEffect(() => {
    if (!initial || auth === "loading" || started.current === initial) return;
    started.current = initial;
    setQ(initial);
    void run(initial);
  }, [initial, auth, run]);

  function ask(query: string) {
    const text = query.trim();
    if (text.length < 3) return;
    setQ(text);
    window.history.replaceState(null, "", `/search?q=${encodeURIComponent(text)}`);
    void run(text);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(q);
  }

  const busy = state.status === "thinking" || state.status === "streaming";

  return (
    <div className="page pb-24 pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      {/* CSS-only rise: the page's first screen paints (and plays) before hydration. */}
      <RiseHeading className="text-display max-w-[13ch]">
        What will you <em>feel</em> tonight?
      </RiseHeading>

      <nav aria-label="Ways to search" className="mt-6 flex w-fit rounded-full border border-hairline-strong p-1 md:mt-8">
        <span aria-current="page" className="rounded-full bg-text px-4 py-1.5 text-[0.875rem] text-bg">
          Ask
        </span>
        <Link href="/mood" className="rounded-full px-4 py-1.5 text-[0.875rem] text-muted transition-colors hover:text-text">
          Mood
        </Link>
      </nav>

      <form onSubmit={onSubmit} className="mt-8 max-w-3xl md:mt-12" role="search">
        <label htmlFor="ask" className="sr-only">
          Describe what you want to watch
        </label>
        <div className="relative overflow-hidden rounded-full border border-hairline-strong bg-surface/50 transition-colors focus-within:border-text/50">
          <MagnifyingGlass size={20} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="ask"
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={240}
            autoComplete="off"
            placeholder="A movie like Jurassic World, but scarier"
            className="h-16 w-full bg-transparent pl-14 pr-36 text-[1.0625rem] text-text outline-none placeholder:text-muted md:text-[1.125rem]"
          />
          {q && !busy ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setQ("");
                reset();
                window.history.replaceState(null, "", "/search");
                input.current?.focus();
              }}
              className="absolute right-[6.5rem] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-text"
            >
              <X size={16} />
            </button>
          ) : null}
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={q.trim().length < 3 && !busy} pending={busy}>
            Ask
          </Button>
          {/* While it thinks, a projector beam sweeps the box. */}
          {busy ? <span aria-hidden="true" className="beam" /> : null}
        </div>
      </form>

      <p className="sr-only" aria-live="polite">
        {state.status === "thinking"
          ? "Reading your request…"
          : state.status === "done"
            ? `${state.items.length} results.`
            : state.status === "error"
              ? state.message
              : ""}
      </p>

      {state.status === "idle" ? (
        <Starters onPick={ask} recent={auth === "signed-in" ? (recent.data ?? []) : []} />
      ) : (
        <Results state={state} signedIn={auth === "signed-in"} onRetry={() => ask(state.query)} />
      )}
    </div>
  );
}

function Starters({ onPick, recent }: { onPick: (q: string) => void; recent: string[] }) {
  return (
    <div className="mt-10 grid max-w-3xl gap-10">
      {/* Static on purpose: the starters are there from the first paint, under the rising heading. */}
      <div>
        <p className="caption text-muted">Try</p>
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => onPick(ex)}
                className="rounded-full border border-hairline-strong px-4 py-2 text-left text-[0.9375rem] text-muted transition-colors hover:border-text/40 hover:text-text"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {recent.length ? (
        <div>
          <p className="caption text-muted">Your recent searches</p>
          <ul className="mt-3 border-t border-hairline">
            {recent.map((r) => (
              <li key={r} className="border-b border-hairline">
                <button type="button" onClick={() => onPick(r)} className="w-full py-3 text-left font-display text-h4 transition-colors hover:text-[var(--color-accent)]">
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Results({ state, signedIn, onRetry }: { state: Exclude<AskState, { status: "idle" }>; signedIn: boolean; onRetry: () => void }) {
  const reduced = useReducedMotion();
  const provisional = state.stage === "candidates";

  return (
    <div className="mt-8 max-w-5xl">
      <ul className="flex min-h-9 flex-wrap gap-2" aria-label="How Reverie read your request">
        <AnimatePresence initial={false}>
          {state.status === "thinking" ? (
            <motion.li key="reading" className="text-meta text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Reading your request…
            </motion.li>
          ) : null}
          {state.chips.map((chip, i) => (
            <motion.li
              key={chip}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 26, delay: i * 0.05 }}
              className="rounded-full border border-hairline-strong bg-raised px-3 py-1.5 text-meta text-text"
            >
              {chip}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {state.status === "error" ? (
        <div className="mt-10 max-w-xl">
          <p className="font-display text-h3">That search didn’t land.</p>
          <p className="mt-3 text-muted">{state.message}</p>
          <Button className="mt-6" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.status !== "error" && state.items.length === 0 && state.stage !== "final" ? <ResultsSkeleton /> : null}
      {state.stage === "final" && state.items.length === 0 ? (
        <p className="mt-10 max-w-xl text-muted">Nothing fits that just yet. Loosen one of the conditions and try again?</p>
      ) : null}

      {state.items.length ? (
        <>
          <div className="mt-8 flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
            <p className="caption text-muted">
              {state.stage === "final"
                ? `Top ${state.items.length}${state.personal ? ", ranked for you" : ""}`
                : state.stage === "ranked"
                  ? "Ranked for your request · checking your taste…"
                  : "First pass · ranking…"}
            </p>
            {state.stage === "final" && state.ms ? (
              <p className="text-meta text-muted">
                <span className="numeral">{(state.ms / 1000).toFixed(1)}</span>s
              </p>
            ) : null}
          </div>
          {!signedIn && state.stage === "final" ? (
            <p className="mt-4 text-meta text-muted">
              <Link href={`/signin?next=${encodeURIComponent(`/search?q=${state.query}`)}`} className="link-draw text-text">
                Sign in
              </Link>{" "}
              to see how much you’ll like each one.
            </p>
          ) : null}
          <LayoutGroup>
            <ol className={cn("transition-opacity duration-500", provisional && "opacity-60")}>
              {state.items.map((item, i) => (
                <ResultRow key={item.key} item={item} rank={i + 1} index={i} provisional={provisional} />
              ))}
            </ol>
          </LayoutGroup>
        </>
      ) : null}
    </div>
  );
}

function ResultRow({ item, rank, index, provisional }: { item: AskItem; rank: number; index: number; provisional: boolean }) {
  const reduced = useReducedMotion();
  const c = item.card;
  const meta = [c.year, cardMeta(c), item.imdb ? `IMDb ${item.imdb.toFixed(1)}` : null].filter(Boolean).join(" · ");
  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: ease.out, delay: index * 0.06, layout: { duration: 0.6, ease: ease.out } }}
      className="relative border-b border-hairline"
    >
      <Link
        href={c.href}
        transitionTypes={["nav-forward"]}
        className="group grid grid-cols-[2.25rem_4rem_minmax(0,1fr)] items-start gap-x-4 py-4 md:grid-cols-[3.5rem_5rem_minmax(0,1fr)_auto] md:items-center md:gap-x-6 md:py-5"
      >
        <span className="numeral self-start pt-1 text-[1.5rem] font-extralight leading-none text-muted md:text-[2rem]" aria-hidden={provisional}>
          {provisional ? "·" : String(rank).padStart(2, "0")}
        </span>
        <span className="relative aspect-[2/3] overflow-hidden rounded-[2px] bg-surface">
          {c.posterPath ? (
            <Image
              src={tmdbImg(c.posterPath, "thumb")!}
              alt=""
              fill
              sizes="80px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[clamp(1.25rem,2.2vw,1.75rem)] leading-tight transition-colors group-hover:text-[var(--color-accent)]">
            {c.title}
          </span>
          <span className="mt-1 block text-meta text-muted [font-variant-numeric:tabular-nums]">{meta}</span>
          {item.why ? <span className="mt-2 block max-w-[62ch] text-[0.9375rem] leading-snug text-text/85">{item.why}</span> : null}
          {item.match != null ? (
            <span className="mt-3 flex items-center gap-2 md:hidden">
              <MatchMini value={item.match} className="size-10" />
              <span className="text-meta text-muted">{item.matchKind === "quick" ? "estimate" : "your match"}</span>
            </span>
          ) : null}
        </span>
        {item.match != null ? (
          <span className="hidden flex-col items-center gap-1 md:flex">
            <MatchMini value={item.match} />
            <span className="text-[0.6875rem] text-muted">{item.matchKind === "quick" ? "estimate" : "your match"}</span>
          </span>
        ) : null}
      </Link>
      {/* Outside the row's link (a button can't sit inside one), tucked under the dial. */}
      {item.match != null && item.match < WHY_LINK_BELOW && !provisional ? (
        <WhyPopover mediaType={c.mediaType} tmdbId={c.tmdbId} title={c.title} href={c.href} className="absolute bottom-3 right-0 md:bottom-2 md:right-3" />
      ) : null}
    </motion.li>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-8 border-t border-hairline" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="grid grid-cols-[2.25rem_4rem_minmax(0,1fr)] items-center gap-x-4 border-b border-hairline py-4 md:grid-cols-[3.5rem_5rem_minmax(0,1fr)] md:gap-x-6">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="aspect-[2/3] w-full" />
          <div>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-2 h-3.5 w-1/3" />
            <Skeleton className="mt-3 h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
