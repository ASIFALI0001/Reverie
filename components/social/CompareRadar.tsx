"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { describeAffinity } from "@/components/taste/TasteRadar";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { RadarPoint } from "@/lib/taste/types";

const SIZE = 320;
const C = SIZE / 2;
const R = 112;
const PAD_X = 48;
const PAD_Y = 28;
const RINGS = [0.25, 0.5, 0.75, 1];

const round = (x: number) => Math.round(x * 10) / 10;
function at(i: number, n: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return [round(C + Math.cos(a) * R * v), round(C + Math.sin(a) * R * v)];
}
const clampV = (v: number) => Math.max(0.04, Math.min(1, v));
const ring = (vals: number[]) => vals.map((v, i) => at(i, vals.length, v).join(",")).join(" ");

/**
 * Two genre radars on one dial: you in amber, your friend in blue (a validated pair: lightness,
 * chroma and colour-blind separation all checked against the page). The friend's shape is also
 * dashed, so the two never depend on colour alone. Their shape grows out of yours on reveal.
 */
export function CompareRadar({ mine, theirs, theirName, className }: { mine: RadarPoint[]; theirs: RadarPoint[]; theirName: string; className?: string }) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);
  const n = mine.length;
  const a = mine.map((p) => clampV(p.value));
  const b = theirs.map((p) => clampV(p.value));

  return (
    <figure className={cn("relative w-full", className)}>
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 text-meta text-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--color-series-you)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          You
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--color-series-them)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
          </svg>
          {theirName}
        </span>
      </figcaption>
      <svg viewBox={`${-PAD_X} ${-PAD_Y} ${SIZE + PAD_X * 2} ${SIZE + PAD_Y * 2}`} className="mt-3 block w-full overflow-visible" role="group" aria-labelledby={titleId}>
        <title id={titleId}>{`Genre radars compared: you and ${theirName}.`}</title>
        {RINGS.map((r) => (
          <polygon key={r} points={ring(mine.map(() => r))} fill="none" stroke={r === 0.5 ? "var(--color-hairline-strong)" : "var(--color-hairline)"} strokeWidth={1} />
        ))}
        {mine.map((p, i) => {
          const [x, y] = at(i, n, 1);
          return <line key={p.axis} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />;
        })}

        <motion.polygon
          points={ring(a)}
          fill="var(--color-series-you)"
          fillOpacity={0.1}
          stroke="var(--color-series-you)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={reduced ? false : { opacity: 0, scale: 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: ease.out, delay: 0.2 }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        />
        {/* Theirs starts as yours, then reshapes into their own. */}
        <motion.polygon
          initial={reduced ? false : { points: ring(a), opacity: 0 }}
          animate={{ points: ring(b), opacity: 1 }}
          transition={{ points: { duration: 1.2, ease: ease.out, delay: 1.05 }, opacity: { duration: 0.3, delay: 1 } }}
          fill="var(--color-series-them)"
          fillOpacity={0.1}
          stroke="var(--color-series-them)"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
        {[a, b].map((vals, s) =>
          vals.map((v, i) => {
            const [x, y] = at(i, n, v);
            return (
              <motion.circle
                key={`${s}-${i}`}
                cx={x}
                cy={y}
                r={4}
                fill={s === 0 ? "var(--color-series-you)" : "var(--color-series-them)"}
                stroke="var(--color-bg)"
                strokeWidth={2}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: active == null || active === i ? 1 : 0.35 }}
                transition={{ duration: 0.3, delay: reduced ? 0 : s === 0 ? 0.9 : 2.1 }}
              />
            );
          }),
        )}
        {mine.map((p, i) => {
          const [x, y] = at(i, n, 1.18);
          const anchor = Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end";
          return (
            <text key={p.axis} x={x} y={y} dy="0.35em" textAnchor={anchor} className={cn("text-[13px]", active === i ? "fill-text" : "fill-muted")}>
              {p.axis}
            </text>
          );
        })}
        {/* One hit target per axis (bigger than the marks); hover and focus show both readings. */}
        {mine.map((p, i) => {
          const [x, y] = at(i, n, Math.max(a[i]!, b[i]!));
          return (
            <circle
              key={p.axis}
              cx={x}
              cy={y}
              r={18}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${p.axis}: you ${describeAffinity(p.value).toLowerCase()}, ${theirName} ${describeAffinity(theirs[i]?.value ?? 0.5).toLowerCase()}`}
              className="cursor-default outline-none focus-visible:stroke-[var(--color-text)]"
              strokeWidth={1.5}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          );
        })}
      </svg>
      {active != null ? (
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-hairline-strong bg-raised px-3 py-2 shadow-lg">
          <p className="text-[0.875rem] text-text">{mine[active]!.axis}</p>
          <p className="text-meta text-muted">
            You: {describeAffinity(mine[active]!.value).toLowerCase()} · {theirName}: {describeAffinity(theirs[active]?.value ?? 0.5).toLowerCase()}
          </p>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Genre pull, you and {theirName}</caption>
        <thead>
          <tr>
            <th scope="col">Genre</th>
            <th scope="col">You</th>
            <th scope="col">{theirName}</th>
          </tr>
        </thead>
        <tbody>
          {mine.map((p, i) => (
            <tr key={p.axis}>
              <th scope="row">{p.axis}</th>
              <td>{describeAffinity(p.value)}</td>
              <td>{describeAffinity(theirs[i]?.value ?? 0.5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
