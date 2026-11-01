"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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

const ring = (vals: number[]) => vals.map((v, i) => at(i, vals.length, v).join(",")).join(" ");

/** 0–1 (0.5 = neutral) in words, so no value is colour- or position-only. */
export function describeAffinity(v: number): string {
  if (v >= 0.72) return "Strong pull";
  if (v >= 0.57) return "Drawn to";
  if (v > 0.43) return "Neutral";
  if (v > 0.28) return "Lukewarm";
  return "Steers clear";
}

/**
 * Genre radar for the Taste DNA. One series, so one colour and no legend; the
 * neutral ring (0.5) is drawn a step stronger so likes and dislikes read either side of it.
 */
export function TasteRadar({ points, animate = true, className }: { points: RadarPoint[]; animate?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const n = points.length;
  // A sliver stays visible at zero so a vertex never collapses into the centre.
  const values = points.map((p) => Math.max(0.04, Math.min(1, p.value)));
  const strongest = values.indexOf(Math.max(...values));
  const grow = animate && !reduced;
  const shown = active != null ? points[active] : null;
  const [tx, ty] = active != null ? at(active, n, values[active]!) : [0, 0];

  return (
    <figure className={cn("relative w-full", className)}>
      <svg
        viewBox={`${-PAD_X} ${-PAD_Y} ${SIZE + PAD_X * 2} ${SIZE + PAD_Y * 2}`}
        className="block w-full overflow-visible"
        role="group"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {`Genre radar. ${points.map((p) => `${p.axis}: ${describeAffinity(p.value).toLowerCase()}`).join("; ")}.`}
        </title>

        {RINGS.map((r) => (
          <polygon
            key={r}
            points={ring(points.map(() => r))}
            fill="none"
            stroke={r === 0.5 ? "var(--color-hairline-strong)" : "var(--color-hairline)"}
            strokeWidth={1}
          />
        ))}
        {points.map((p, i) => {
          const [x, y] = at(i, n, 1);
          return <line key={p.axis} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />;
        })}

        <motion.g
          initial={grow ? { scale: 0.15, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: ease.out, delay: 0.35 }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          <polygon
            points={ring(values)}
            fill="var(--color-accent)"
            fillOpacity={0.14}
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {values.map((v, i) => {
            const [x, y] = at(i, n, v);
            return <circle key={points[i]!.axis} cx={x} cy={y} r={4} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />;
          })}
        </motion.g>

        {points.map((p, i) => {
          const [x, y] = at(i, n, 1.17);
          const anchor = Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end";
          return (
            <text
              key={p.axis}
              x={x}
              y={y}
              dy="0.35em"
              textAnchor={anchor}
              className={cn("text-[13px]", i === strongest ? "fill-text" : "fill-muted")}
            >
              {p.axis}
            </text>
          );
        })}

        {/* Hit targets bigger than the marks; keyboard focus shows the same tooltip as hover. */}
        <g>
          {values.map((v, i) => {
            const [x, y] = at(i, n, v);
            const p = points[i]!;
            return (
              <circle
                key={p.axis}
                cx={x}
                cy={y}
                r={16}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${p.axis}: ${describeAffinity(p.value)}, from ${p.evidence} title${p.evidence === 1 ? "" : "s"}`}
                className="cursor-default outline-none focus-visible:stroke-[var(--color-accent)]"
                strokeWidth={1.5}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            );
          })}
        </g>
      </svg>

      {shown ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-[6px] border border-hairline-strong bg-raised px-3 py-2 shadow-lg"
          style={{
            left: `${((tx + PAD_X) / (SIZE + PAD_X * 2)) * 100}%`,
            top: `${((ty + PAD_Y) / (SIZE + PAD_Y * 2)) * 100}%`,
          }}
        >
          <p className="text-[0.875rem] text-text">
            {shown.axis} <span className="text-muted">· {describeAffinity(shown.value)}</span>
          </p>
          <p className="text-meta text-muted">
            {shown.evidence ? `From ${shown.evidence} title${shown.evidence === 1 ? "" : "s"}` : "Nothing to go on yet"}
          </p>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>Genre affinity</caption>
        <thead>
          <tr>
            <th scope="col">Genre</th>
            <th scope="col">Pull</th>
            <th scope="col">Titles behind it</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.axis}>
              <th scope="row">{p.axis}</th>
              <td>{describeAffinity(p.value)}</td>
              <td>{p.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
