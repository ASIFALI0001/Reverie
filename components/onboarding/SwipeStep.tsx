"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUUpLeft, EyeSlash, Heart, X } from "@phosphor-icons/react";
import { Button, IconButton } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { Skeleton } from "@/components/ui/Skeleton";
import { StepFrame } from "@/components/onboarding/StepFrame";
import { CardFace, SwipeCard, type SwipeCardHandle } from "@/components/onboarding/SwipeCard";
import { useSwipeDeck } from "@/lib/api/taste";
import { useOnboarding } from "@/lib/store/onboarding";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import type { DeckCard, SwipeVerdict } from "@/lib/taste/types";

const VERDICT: Record<SwipeVerdict, string> = { loved: "Loved", disliked: "Not for you", unseen: "Haven’t seen" };

/** The deck fits the viewport: the card's height gives way before the controls do. */
const DECK_SIZE = "h-[clamp(18rem,calc(100svh-23rem),31rem)] md:h-[clamp(20rem,calc(100svh-25rem),32rem)]";

export function SwipeStep() {
  const formats = useOnboarding((s) => s.formats);
  const genres = useOnboarding((s) => s.genres);
  const swipes = useOnboarding((s) => s.swipes);
  const swipe = useOnboarding((s) => s.swipe);
  const undo = useOnboarding((s) => s.undoSwipe);
  const next = useOnboarding((s) => s.next);
  const back = useOnboarding((s) => s.back);
  const deck = useSwipeDeck(formats, genres);
  const cardRef = useRef<SwipeCardHandle>(null);
  const [announce, setAnnounce] = useState("");
  const reduced = useReducedMotion();

  const cards = deck.data?.cards ?? [];
  const decided = new Map(swipes.map((s) => [s.key, s.verdict]));
  const remaining = cards.filter((c) => !decided.has(c.key));
  const seen = cards.length - remaining.length;
  const done = cards.length > 0 && remaining.length === 0;
  const lastInDeck = [...swipes].reverse().find((s) => cards.some((c) => c.key === s.key));

  const decide = useCallback(
    (card: DeckCard, verdict: SwipeVerdict) => {
      swipe({ key: card.key, verdict, title: card.title, posterPath: card.posterPath });
      setAnnounce(`${VERDICT[verdict]}: ${card.title}`);
    },
    [swipe],
  );

  const undoLast = useCallback(() => {
    if (!lastInDeck) return;
    undo();
    setAnnounce(`Back to ${lastInDeck.title}`);
  }, [lastInDeck, undo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]") || e.altKey || e.metaKey || e.ctrlKey) return;
      const verdict = e.key === "ArrowRight" ? "loved" : e.key === "ArrowLeft" ? "disliked" : e.key === "ArrowUp" ? "unseen" : null;
      if (verdict) {
        e.preventDefault();
        cardRef.current?.fling(verdict);
      } else if (e.key === "Backspace" || e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoLast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLast]);

  // A beat to enjoy the empty table, then on to favourites.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(next, reduced ? 600 : 1600);
    return () => clearTimeout(t);
  }, [done, next, reduced]);

  const counts = cards.reduce(
    (acc, c) => {
      const v = decided.get(c.key);
      if (v) acc[v]++;
      return acc;
    },
    { loved: 0, disliked: 0, unseen: 0 } as Record<SwipeVerdict, number>,
  );

  return (
    <StepFrame
      compact
      title={
        <>
          Swipe through <em>these</em>
        </>
      }
      lede="Right if you loved it, left if it’s not for you, up if you haven’t seen it."
    >
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="flex flex-col items-center">
        <div className={cn("relative aspect-[2/3]", DECK_SIZE)}>
          {deck.isPending ? (
            <Skeleton className="absolute inset-0 rounded-[4px]" />
          ) : deck.isError ? (
            <DeckMessage title="The deck didn’t load." body="Check your connection and try again.">
              <Button size="sm" onClick={() => deck.refetch()}>
                Try again
              </Button>
            </DeckMessage>
          ) : cards.length === 0 ? (
            <DeckMessage title="Nothing to swipe for those picks." body="Skip ahead; your favourites will do the talking.">
              <Button size="sm" onClick={next}>
                Continue
              </Button>
            </DeckMessage>
          ) : done ? (
            <DeckMessage
              title="That’s the deck."
              body={`Loved ${counts.loved}, passed on ${counts.disliked}, ${counts.unseen} still to see.`}
            >
              <Button size="sm" onClick={next}>
                Continue
              </Button>
            </DeckMessage>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {remaining.slice(1, 3).map((card, i) => (
                  <motion.div
                    key={card.key}
                    aria-hidden="true"
                    className="absolute inset-0 overflow-hidden rounded-[4px] bg-surface shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]"
                    style={{ zIndex: 2 - i }}
                    initial={{ opacity: 0, scale: 0.85, y: 40 }}
                    animate={{ opacity: i === 0 ? 1 : 0.7, scale: 1 - (i + 1) * 0.05, y: (i + 1) * 18 }}
                    exit={{ opacity: 0 }}
                    transition={reduced ? { duration: 0 } : spring.soft}
                  >
                    <CardFace card={card} priority={i === 0} />
                    <span className="absolute inset-0 bg-black/25" />
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Outside AnimatePresence: its fling is its exit, and the shared ref must never be
                  cleared by an outgoing card after the next one has claimed it. */}
              {remaining[0] ? (
                <SwipeCard
                  key={remaining[0].key}
                  ref={cardRef}
                  card={remaining[0]}
                  position={`${seen + 1} of ${cards.length}`}
                  onDecide={(v) => decide(remaining[0]!, v)}
                />
              ) : null}
            </>
          )}
        </div>

        <div className="mt-8 flex w-full max-w-sm items-center justify-between">
          <Button variant="ghost" size="sm" onClick={undoLast} disabled={!lastInDeck} className="w-24 justify-start px-2">
            <ArrowUUpLeft size={16} aria-hidden="true" />
            Undo
          </Button>
          <div className="flex items-center gap-3">
            <IconButton aria-label="Not for me" onClick={() => cardRef.current?.fling("disliked")} disabled={!remaining.length} className="size-14">
              <X size={22} />
            </IconButton>
            <IconButton aria-label="Haven’t seen it" onClick={() => cardRef.current?.fling("unseen")} disabled={!remaining.length} className="size-11">
              <EyeSlash size={18} />
            </IconButton>
            <IconButton
              aria-label="Loved it"
              onClick={() => cardRef.current?.fling("loved")}
              disabled={!remaining.length}
              className="size-14 border-accent/70 text-accent hover:bg-accent/10"
            >
              <Heart size={22} weight="fill" />
            </IconButton>
          </div>
          <p className="w-24 text-right text-meta text-muted">
            {cards.length ? (
              <>
                <span className="numeral text-text">{Math.min(seen + 1, cards.length)}</span>
                <span className="numeral"> / {cards.length}</span>
              </>
            ) : null}
          </p>
        </div>

        <motion.p
          className="mt-6 hidden items-center gap-5 text-meta text-muted md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: ease.out, delay: 0.6 }}
        >
          <span className="flex items-center gap-2">
            <Kbd>←</Kbd> Not for me
          </span>
          <span className="flex items-center gap-2">
            <Kbd>↑</Kbd> Haven’t seen
          </span>
          <span className="flex items-center gap-2">
            <Kbd>→</Kbd> Loved it
          </span>
          <span className="flex items-center gap-2">
            <Kbd>Z</Kbd> Undo
          </span>
        </motion.p>

        <Button variant="ghost" size="sm" onClick={back} className="mt-6 md:hidden">
          Back
        </Button>
      </div>
    </StepFrame>
  );
}

function DeckMessage({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-[4px] border border-hairline-strong bg-surface p-8 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: ease.out }}
    >
      <p className="font-display text-h3">{title}</p>
      <p className="mt-3 max-w-[26ch] text-muted">{body}</p>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
