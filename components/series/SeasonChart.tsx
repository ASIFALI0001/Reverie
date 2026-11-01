"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ease } from "@/lib/motion";
import type { Position, SeasonBar } from "@/lib/series/trend";

const H = 150;
const PAD_T = 16;
const PAD_B = 26;
const PAD_L = 26;
const STEP = 14;
const GAP = 18;
const MIN = 5;
const MAX = 10;

/** Seasons left to right, a small gap between them. */
function layout(chart: SeasonBar[]) {
  const seasons = [];
  let x = PAD_L;
  for (const s of chart) {
    const start = x;
    const pts = s.episodes.map((e, i) => ({ ...e, x: start + i * STEP + STEP / 2 }));
    seasons.push({ ...s, start, end: start + s.episodes.length * STEP, pts });
    x = start + s.episodes.length * STEP + GAP;
  }
  return { seasons, width: Math.max(x - GAP + 8, 240) };
}

/**
 * Episode ratings, season by season, with "you are here". One series, so no legend: what you've
 * seen in muted ink, what's ahead in the accent. Only numbers (never episode titles, which can
 * spoil); a dot per episode with a readout on hover or focus, and a table for screen readers.
 */
export function SeasonChart({ chart, position }: { chart: SeasonBar[]; position: Position }) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const [active, setActive] = useState<string | null>(null);

  const { seasons, width } = layout(chart);
  const y = (r: number) => PAD_T + (1 - (Math.max(MIN, Math.min(MAX, r)) - MIN) / (MAX - MIN)) * (H - PAD_T - PAD_B);
  const ahead = (s: number, e: number) => s > position.season || (s === position.season && e > position.episode);
  const here = seasons.find((s) => s.season === position.season)?.pts.find((p) => p.episode === position.episode);
  const shown = active ? seasons.flatMap((s) => s.pts.map((p) => ({ ...p, season: s.season }))).find((p) => `${p.season}-${p.episode}` === active) : null;

  // Long series scroll sideways: open with "you are here" in view, a quarter of the way in.
  const scroller = useRef<HTMLDivElement>(null);
  const hereX = here?.x ?? null;
  useEffect(() => {
    const el = scroller.current;
    if (el && hereX != null) el.scrollLeft = Math.max(0, hereX - el.clientWidth / 4);
  }, [hereX]);

  return (
    <figure className="relative">
      <p className="flex gap-4 text-meta text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-muted" /> Seen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> Still ahead
        </span>
      </p>
      <div ref={scroller} className="mt-2 overflow-x-auto pb-1" data-lenis-prevent>
        <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="group" aria-labelledby={titleId} className="block overflow-visible">
          <title id={titleId}>{`Episode ratings by season. You are at season ${position.season}, episode ${position.episode}.`}</title>
          {[6, 8, 10].map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={width - 4} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--color-muted)] text-[10px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {seasons.map((s, si) => {
            const rated = s.pts.filter((p) => p.rating != null);
            const path = rated.map((p, i) => `${i ? "L" : "M"}${p.x},${y(p.rating!)}`).join("");
            return (
              <g key={s.season}>
                <text x={s.start} y={H - 6} className="fill-[var(--color-muted)] text-[10px]">
                  S{s.season}
                  {s.avg != null ? ` · ${s.avg}` : ""}
                </text>
                {rated.length > 1 ? (
                  <motion.path
                    d={path}
                    fill="none"
                    stroke="var(--color-text)"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, ease: ease.out, delay: 0.2 + si * 0.12 }}
                  />
                ) : null}
                {s.pts.map((p, i) =>
                  p.rating == null ? null : (
                    <motion.circle
                      key={p.episode}
                      cx={p.x}
                      cy={y(p.rating)}
                      r={4}
                      fill={ahead(s.season, p.episode) ? "var(--color-accent)" : "var(--color-muted)"}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                      initial={reduced ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.35, delay: reduced ? 0 : 0.3 + si * 0.12 + i * 0.02 }}
                    />
                  ),
                )}
              </g>
            );
          })}
          {here ? (
            <g pointerEvents="none">
              <line x1={here.x} x2={here.x} y1={PAD_T - 6} y2={H - PAD_B + 4} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={here.x} y={PAD_T - 9} textAnchor="middle" className="fill-[var(--color-text)] text-[10px]">
                You are here
              </text>
            </g>
          ) : null}
          {/* Hit targets bigger than the dots; keyboard focus shows the same readout. */}
          {seasons.flatMap((s) =>
            s.pts.map((p) =>
              p.rating == null ? null : (
                <circle
                  key={`hit-${s.season}-${p.episode}`}
                  cx={p.x}
                  cy={y(p.rating)}
                  r={9}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`Season ${s.season}, episode ${p.episode}: rated ${p.rating}${ahead(s.season, p.episode) ? ", still ahead" : ""}`}
                  className="outline-none focus-visible:stroke-[var(--color-accent)]"
                  strokeWidth={1.5}
                  onPointerEnter={() => setActive(`${s.season}-${p.episode}`)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(`${s.season}-${p.episode}`)}
                  onBlur={() => setActive(null)}
                />
              ),
            ),
          )}
        </svg>
      </div>
      {shown ? (
        <p aria-hidden="true" className="pointer-events-none absolute right-0 top-0 rounded-[4px] border border-hairline-strong bg-raised px-2.5 py-1.5 text-meta tabular-nums">
          S{shown.season}E{shown.episode} · <span className="text-text">{shown.rating}</span>
        </p>
      ) : null}
      <table className="sr-only">
        <caption>Average episode rating by season</caption>
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">Average</th>
          </tr>
        </thead>
        <tbody>
          {chart.map((s) => (
            <tr key={s.season}>
              <th scope="row">Season {s.season}</th>
              <td>{s.avg ?? "No ratings yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
