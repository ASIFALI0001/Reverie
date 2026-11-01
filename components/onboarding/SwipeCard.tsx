"use client";

import Image from "next/image";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue, type PanInfo } from "motion/react";
import { CATEGORY_LABEL } from "@/lib/catalog/category";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import type { DeckCard, SwipeVerdict } from "@/lib/taste/types";

export type SwipeCardHandle = { fling: (verdict: SwipeVerdict) => void };

/** Past this distance (px) or speed (px/s) a release counts as a decision. */
const DISTANCE = 110;
const SPEED = 650;
const springBack = { type: "spring", stiffness: 420, damping: 30 } as const;

type Props = { card: DeckCard; position: string; onDecide: (verdict: SwipeVerdict) => void };

/** The top card: drag it, and it tilts with you; let go short of a decision and it springs home. */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard({ card, position, onDecide }, ref) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-260, 260], [-16, 16]);
  // Stamps fade in with drag distance and settle from slightly larger, like they're being pressed on.
  const loved = useTransform(x, [16, 84], [0, 1]);
  const nope = useTransform(x, [-84, -16], [1, 0]);
  const unseen = useTransform(y, [-84, -24], [1, 0]);
  const lovedScale = useTransform(loved, [0, 1], [1.4, 1]);
  const nopeScale = useTransform(nope, [0, 1], [1.4, 1]);
  const unseenScale = useTransform(unseen, [0, 1], [1.4, 1]);
  const leaving = useRef(false);

  const fling = useCallback(
    async (verdict: SwipeVerdict) => {
      if (leaving.current) return;
      leaving.current = true;
      if (reduced) {
        await animate(opacity, 0, { duration: 0.18 });
        onDecide(verdict);
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const to =
        verdict === "loved"
          ? { x: w * 0.75 + 260, y: y.get() + 60 }
          : verdict === "disliked"
            ? { x: -(w * 0.75 + 260), y: y.get() + 60 }
            : { x: x.get() * 0.3, y: -(h * 0.9 + 240) };
      const out = { duration: 0.42, ease: [0.4, 0, 0.9, 0.6] as const };
      await Promise.all([animate(x, to.x, out), animate(y, to.y, out)]);
      onDecide(verdict);
    },
    [onDecide, opacity, reduced, x, y],
  );

  useImperativeHandle(ref, () => ({ fling }), [fling]);

  function onDragEnd(_: unknown, { offset, velocity }: PanInfo) {
    if (offset.x > DISTANCE || velocity.x > SPEED) return void fling("loved");
    if (offset.x < -DISTANCE || velocity.x < -SPEED) return void fling("disliked");
    if (offset.y < -DISTANCE || velocity.y < -SPEED) return void fling("unseen");
    animate(x, 0, springBack);
    animate(y, 0, springBack);
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={onDragEnd}
      style={{ x, y, rotate, opacity, zIndex: 3 }}
      initial={reduced ? false : { scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden rounded-[4px] bg-surface shadow-[0_40px_80px_-30px_rgb(0_0_0/0.85)] active:cursor-grabbing"
      role="group"
      aria-roledescription="card"
      aria-label={`${card.title}, ${position}`}
    >
      <CardFace card={card} priority />
      <Stamp label="Loved" opacity={loved} scale={lovedScale} className="left-5 top-6 -rotate-12 border-accent text-accent" />
      <Stamp label="Nope" opacity={nope} scale={nopeScale} className="right-5 top-6 rotate-12 border-[#f07167] text-[#f07167]" />
      <Stamp
        label="Haven’t seen"
        opacity={unseen}
        scale={unseenScale}
        className="bottom-32 left-1/2 -ml-[5.5rem] w-[11rem] -rotate-3 border-white text-center text-white"
      />
    </motion.div>
  );
});

function Stamp({
  label,
  opacity,
  scale,
  className,
}: {
  label: string;
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
  className: string;
}) {
  return (
    <motion.span
      aria-hidden="true"
      style={{ opacity, scale }}
      className={cn(
        "pointer-events-none absolute z-10 rounded-[4px] border-[3px] bg-black/60 px-3 py-1 font-mono text-[1.375rem] font-semibold uppercase tracking-[0.16em] shadow-[0_8px_24px_rgb(0_0_0/0.45)] backdrop-blur-[3px]",
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

/** Poster, plus title and meta on a scrim. Text is fixed white: it always sits on a photograph. */
export function CardFace({ card, priority = false }: { card: DeckCard; priority?: boolean }) {
  const meta = [card.year, CATEGORY_LABEL[card.category], card.genres.join(", ")].filter(Boolean).join(" · ");
  return (
    <>
      <Image
        src={tmdbImg(card.posterPath)!}
        alt=""
        fill
        draggable={false}
        sizes="(min-width: 768px) 360px, 80vw"
        priority={priority}
        className="pointer-events-none object-cover"
        style={card.color ? { backgroundColor: card.color } : undefined}
      />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/90 via-black/45 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 p-5">
        <span className="block font-display text-[clamp(1.625rem,4vw,2rem)] leading-[1.02] text-white">{card.title}</span>
        <span className="mt-1.5 block text-meta text-white/70">{meta}</span>
      </span>
    </>
  );
}
