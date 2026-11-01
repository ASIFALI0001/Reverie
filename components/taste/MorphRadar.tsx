"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { describeAffinity } from "@/components/taste/TasteRadar";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { RadarPoint } from "@/lib/taste/types";

const SIZE = 320;
const C = SIZE / 2;
const R = 112;
const PAD_X = 44;
const PAD_Y = 26;
const RINGS = [0.25, 0.5, 0.75, 1];

const round = (x: number) => Math.round(x * 10) / 10;
function at(i: number, n: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return [round(C + Math.cos(a) * R * v), round(C + Math.sin(a) * R * v)];
}
const clampV = (v: number) => Math.max(0.04, Math.min(1, v));
const ring = (vals: number[]) => vals.map((v, i) => at(i, vals.length, v).join(",")).join(" ");

const SHAPE = { fill: "var(--color-accent)", fillOpacity: 0.14, stroke: "var(--color-accent)", strokeWidth: 2, strokeLinejoin: "round" } as const;
const DOT = { r: 4, fill: "var(--color-accent)", stroke: "var(--color-bg)", strokeWidth: 2 } as const;

/**
 * The genre radar of one era, reshaping itself from `from` (the era before) into this one. One
 * series, so one colour and no legend; the strongest axis is named in full ink, and the text
 * alternative reads the whole shape. With reduced motion it simply shows the shape.
 */
export function MorphRadar({
  points,
  from,
  label,
  when = "mount",
  labels = true,
  className,
}: {
  points: RadarPoint[];
  from?: RadarPoint[] | null;
  label: string;
  /** "view": reshape when scrolled into view (a list of eras); "mount": straight away, and on every change. */
  when?: "mount" | "view";
  /** Name the axes. Off for thumbnails, where the names would be too small to read (the text alternative still has them). */
  labels?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const n = points.length;
  const values = points.map((p) => clampV(p.value));
  const start = from?.length === n ? from.map((p) => clampV(p.value)) : values.map(() => 0.04);
  const strongest = values.indexOf(Math.max(...values));
  const transition = { duration: 0.9, ease: ease.out };
  const go = <T,>(target: T) => (when === "view" ? { whileInView: target, viewport: { once: true, amount: 0.6 } } : { animate: target });

  return (
    <figure className={cn("relative w-full", className)}>
      <svg
        // Without names round the edge, the frame closes in on the radar itself (room for the dots).
        viewBox={labels ? `${-PAD_X} ${-PAD_Y} ${SIZE + PAD_X * 2} ${SIZE + PAD_Y * 2}` : `${C - R - 6} ${C - R - 6} ${2 * R + 12} ${2 * R + 12}`}
        className="block w-full overflow-visible"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{`${label}: ${points.map((p) => `${p.axis} ${describeAffinity(p.value).toLowerCase()}`).join("; ")}.`}</title>
        {RINGS.map((r) => (
          <polygon key={r} points={ring(points.map(() => r))} fill="none" stroke={r === 0.5 ? "var(--color-hairline-strong)" : "var(--color-hairline)"} strokeWidth={1} />
        ))}
        {points.map((p, i) => {
          const [x, y] = at(i, n, 1);
          return <line key={p.axis} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />;
        })}
        {reduced ? (
          <>
            <polygon points={ring(values)} {...SHAPE} />
            {values.map((v, i) => {
              const [x, y] = at(i, n, v);
              return <circle key={points[i]!.axis} cx={x} cy={y} {...DOT} />;
            })}
          </>
        ) : (
          <>
            <motion.polygon initial={{ points: ring(start) }} {...go({ points: ring(values) })} transition={transition} {...SHAPE} />
            {values.map((v, i) => {
              const [x, y] = at(i, n, v);
              const [sx, sy] = at(i, n, start[i]!);
              return <motion.circle key={points[i]!.axis} initial={{ cx: sx, cy: sy }} {...go({ cx: x, cy: y })} transition={transition} {...DOT} />;
            })}
          </>
        )}
        {labels && points.map((p, i) => {
          const [x, y] = at(i, n, 1.17);
          const anchor = Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end";
          return (
            <text key={p.axis} x={x} y={y} dy="0.35em" textAnchor={anchor} className={cn("text-[13px] transition-colors duration-500", i === strongest ? "fill-text" : "fill-muted")}>
              {p.axis}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
