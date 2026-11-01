"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, ViewTransition } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { MatchBadge } from "@/components/title/MatchRing";
import { posterTransitionName, usePendingPoster } from "@/lib/store/pending-poster";
import { cn } from "@/lib/cn";

export type PosterCardProps = {
  href: string;
  title: string;
  posterSrc: string;
  /** TMDB title key ("movie:68721"). Enables the poster → hero morph. */
  titleKey?: string;
  /** Raw TMDB poster path, recorded for the destination's instant shell. */
  posterPath?: string | null;
  blur?: string | null;
  /** Dominant poster colour for the hover glow. */
  color?: string;
  year?: number | null;
  meta?: string | null;
  /** Shown in place of the year and meta line (e.g. "3 twins rated this 9+"). */
  note?: string | null;
  match?: number | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/** Desktop rails show posters ~220px wide; the title hero uses the same `sizes` so the file is reused. */
export const POSTER_SIZES = "(min-width: 1280px) 220px, (min-width: 768px) 22vw, 42vw";

/**
 * A poster as a physical object under a lamp: it tilts toward the cursor,
 * catches a sheen, and throws a glow in its own dominant colour. Pressing it
 * arms the shared-element name so the poster flies into the title hero.
 */
export function PosterCard({
  href,
  title,
  posterSrc,
  titleKey,
  posterPath,
  blur,
  color = "var(--color-accent)",
  year,
  meta,
  note,
  match,
  sizes = POSTER_SIZES,
  priority,
  className,
}: PosterCardProps) {
  const reduced = useReducedMotion();
  const setPending = usePendingPoster((s) => s.set);
  // Names must be unique on screen, and a title can sit in two rails at once —
  // so a card only claims its transition name when it's the one being opened.
  const [armed, setArmed] = useState(false);
  const rx = useSpring(0, { stiffness: 220, damping: 22 });
  const ry = useSpring(0, { stiffness: 220, damping: 22 });
  const mx = useMotionValue(50);
  const my = useMotionValue(30);
  const sheen = useMotionTemplate`radial-gradient(120% 80% at ${mx}% ${my}%, rgb(255 255 255 / 0.16), transparent 55%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 11);
    rx.set((0.5 - py) * 11);
    mx.set(px * 100);
    my.set(py * 100);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };
  const open = () => {
    if (!titleKey || !posterPath) return;
    setArmed(true);
    setPending({ key: titleKey, title, year: year ?? null, posterPath, blur, color });
    rx.set(0);
    ry.set(0);
  };

  return (
    <Link
      href={href}
      data-cursor="view"
      onPointerDown={open}
      onClick={open}
      transitionTypes={["nav-forward"]}
      className={cn("group block focus-visible:outline-offset-4", className)}
    >
      <div className="relative [perspective:900px]">
        {/* Light spill in the poster's own colour — opacity/transform only. The box is
            much larger than the poster so the falloff lands well outside its edges. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-[45%] -inset-y-[30%] scale-90 opacity-0 transition-[opacity,transform] duration-700 ease-out group-hover:scale-100 group-hover:opacity-100"
          style={{
            background: `radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, ${color} 50%, transparent) 0%, transparent 100%)`,
          }}
        />
        <motion.div
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          whileTap={{ scale: 0.975 }}
          style={{ rotateX: rx, rotateY: ry }}
          className="relative aspect-[2/3] [transform-style:preserve-3d]"
        >
          <ViewTransition name={armed && titleKey ? posterTransitionName(titleKey) : undefined} share="morph" default="none">
            <div className="absolute inset-0 overflow-hidden rounded-[var(--radius-poster)] bg-surface">
              <Image
                src={posterSrc}
                alt={`${title}${year ? ` (${year})` : ""} poster`}
                fill
                sizes={sizes}
                priority={priority}
                placeholder={blur ? "blur" : "empty"}
                blurDataURL={blur ?? undefined}
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            </div>
          </ViewTransition>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-poster)] opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: sheen }}
          />
          {match != null ? (
            <div className="absolute bottom-0 left-0 p-2.5">
              <MatchBadge value={match} className="transition-transform duration-500 ease-out group-hover:-translate-y-0.5" />
            </div>
          ) : null}
        </motion.div>
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-[0.9375rem] leading-snug text-text">{title}</p>
        {note ? (
          <p className="mt-0.5 truncate text-meta text-muted">{note}</p>
        ) : year || meta ? (
          <p className="mt-0.5 truncate text-meta text-muted [font-variant-numeric:tabular-nums]">
            {year}
            {year && meta ? (
              <span aria-hidden="true" className="mx-1.5 text-faint">
                ·
              </span>
            ) : null}
            {meta}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
