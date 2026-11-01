"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Month = { start: string; count: number; shares: number[] | null };

const PAD = { l: 40, r: 8, t: 8, b: 26 };
// Spelled out in full: Tailwind only keeps theme colours whose names it can find in the source.
const GENRE_COLORS = ["var(--color-genre-1)", "var(--color-genre-2)", "var(--color-genre-3)", "var(--color-genre-4)", "var(--color-genre-5)"];
const label = (iso: string, withYear = false) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "short", ...(withYear ? { year: "2-digit" } : {}), timeZone: "UTC" }).replace(/ (\d\d)$/, " ’$1");
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * What you watched, month by month: each genre's share, stacked to 100%. Colours come from the
 * validated genre palette in a fixed order (Other always last, in neutral); the legend is always
 * there, months with nothing logged stay visible as gaps, and every month can be read on hover,
 * with the arrow keys, or in the table.
 */
export function GenreStack({ genres, months, className }: { genres: string[]; months: Month[]; className?: string }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const clipId = useId();
  const titleId = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasOther = months.some((m) => (m.shares?.[genres.length] ?? 0) > 0.005);
  const series = [...genres.slice(0, GENRE_COLORS.length).map((g, i) => ({ name: g, color: GENRE_COLORS[i]! })), ...(hasOther ? [{ name: "Other", color: "var(--color-genre-other)" }] : [])];
  const H = width && width < 560 ? 200 : 240;
  const plotW = Math.max(0, width - PAD.l - PAD.r);
  const plotH = H - PAD.t - PAD.b;
  const n = months.length;
  const step = n > 1 ? plotW / (n - 1) : plotW;
  const x = (i: number) => (n > 1 ? PAD.l + i * step : PAD.l + plotW / 2);
  const y = (v: number) => PAD.t + (1 - v) * plotH;
  const stacks = months.map((m) => {
    if (!m.shares) return null;
    const vals = series.map((_, s) => m.shares![s] ?? 0);
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cum = [0];
    for (const v of vals) cum.push(cum.at(-1)! + v / total);
    return cum;
  });

  // Runs of months with something logged; a lone month is drawn as a narrow column.
  const runs: [number, number][] = [];
  stacks.forEach((s, i) => {
    if (!s) return;
    const last = runs.at(-1);
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  const colW = Math.min(Math.max(step * 0.5, 10), 28);

  // Month labels that don't collide: every k-th, the first and the last (and the one before the
  // last makes way for it when they'd touch).
  const every = Math.max(1, Math.ceil(56 / Math.max(step, 1)));
  const labelled = months.map((_, i) => i % every === 0);
  if (n > 1) {
    const prev = Math.floor((n - 1) / every) * every;
    labelled[n - 1] = true;
    if (prev !== 0 && prev !== n - 1 && (n - 1 - prev) * step < 56) labelled[prev] = false;
  }

  function onKey(e: KeyboardEvent) {
    if (!n) return;
    const cur = active ?? n - 1;
    const next = e.key === "ArrowLeft" ? Math.max(0, cur - 1) : e.key === "ArrowRight" ? Math.min(n - 1, cur + 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next == null) return;
    e.preventDefault();
    setActive(next);
  }

  const shown = active != null ? months[active] : null;
  const shownStack = active != null ? stacks[active] : null;
  const leftSide = active != null && x(active) > PAD.l + plotW / 2;

  return (
    <figure className={cn("relative", className)}>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-2 text-meta text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </figcaption>
      <div ref={box} className="relative mt-4">
        {width ? (
          <svg
            width={width}
            height={H}
            viewBox={`0 0 ${width} ${H}`}
            role="group"
            aria-labelledby={titleId}
            tabIndex={0}
            onKeyDown={onKey}
            onFocus={() => setActive((a) => a ?? n - 1)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className="block overflow-visible rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-bg)]"
          >
            <title id={titleId}>Genre share by month. Use the left and right arrow keys to read each month; the table below has the same numbers.</title>
            <defs>
              <clipPath id={clipId}>
                {reduced ? (
                  <rect x={0} y={0} width={width} height={H} />
                ) : (
                  <motion.rect
                    x={0}
                    y={0}
                    height={H}
                    initial={{ width: 0 }}
                    whileInView={{ width }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 1.4, ease: ease.out }}
                  />
                )}
              </clipPath>
            </defs>
            {[0, 0.5, 1].map((v) => (
              <text key={v} x={PAD.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--color-muted)] text-[11px] tabular-nums">
                {pct(v)}
              </text>
            ))}
            <line x1={PAD.l} x2={PAD.l + plotW} y1={y(0)} y2={y(0)} stroke="var(--color-hairline-strong)" strokeWidth={1} />
            <g clipPath={`url(#${clipId})`}>
              {runs.map(([a, b]) =>
                series.map((s, si) => {
                  if (a === b) {
                    const cum = stacks[a]!;
                    const top = y(cum[si + 1]!);
                    const h = y(cum[si]!) - top;
                    return h > 0.2 ? <rect key={`${a}-${si}`} x={x(a) - colW / 2} y={top} width={colW} height={h} fill={s.color} stroke="var(--color-bg)" strokeWidth={2} /> : null;
                  }
                  const idx = Array.from({ length: b - a + 1 }, (_, k) => a + k);
                  const upper = idx.map((i) => `${x(i)},${y(stacks[i]![si + 1]!)}`);
                  const lower = idx.reverse().map((i) => `${x(i)},${y(stacks[i]![si]!)}`);
                  return <path key={`${a}-${si}`} d={`M${upper.join("L")}L${lower.join("L")}Z`} fill={s.color} stroke="var(--color-bg)" strokeWidth={2} strokeLinejoin="round" />;
                }),
              )}
            </g>
            {months.map((m, i) =>
              m.shares ? null : <line key={`gap-${i}`} x1={x(i) - step / 2 + 4} x2={x(i) + step / 2 - 4} y1={y(0) - 1} y2={y(0) - 1} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="2 4" />,
            )}
            {months.map((m, i) =>
              labelled[i] ? (
                <text key={m.start} x={x(i)} y={H - 6} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"} className="fill-[var(--color-muted)] text-[11px]">
                  {label(m.start, i === 0 || i === n - 1 || new Date(m.start).getUTCMonth() === 0)}
                </text>
              ) : null,
            )}
            {active != null ? <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={y(0)} stroke="var(--color-text)" strokeWidth={1} pointerEvents="none" /> : null}
            {months.map((m, i) => (
              <rect
                key={`hit-${m.start}`}
                x={n > 1 ? x(i) - step / 2 : PAD.l}
                y={PAD.t}
                width={n > 1 ? step : plotW}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
              />
            ))}
          </svg>
        ) : (
          <div style={{ height: 240 }} />
        )}
        {shown ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-[6px] border border-hairline-strong bg-raised px-3 py-2.5 shadow-lg"
            style={leftSide ? { right: width - x(active!) + 12 } : { left: x(active!) + 12 }}
          >
            <p className="text-[0.875rem] text-text">
              {label(shown.start, true)} <span className="text-muted">· {shown.count ? `${shown.count} title${shown.count === 1 ? "" : "s"}` : "nothing logged"}</span>
            </p>
            {shownStack ? (
              <ul className="mt-1.5 space-y-1">
                {series
                  .map((s, si) => ({ ...s, v: shownStack[si + 1]! - shownStack[si]! }))
                  .filter((s) => s.v > 0.005)
                  .map((s) => (
                    <li key={s.name} className="flex items-center gap-2 text-meta">
                      <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                      <span className="text-muted">{s.name}</span>
                      <span className="ml-auto pl-3 text-text tabular-nums">{pct(s.v)}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>Genre share by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Titles</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m.start}>
              <th scope="row">{label(m.start, true)}</th>
              <td>{m.count}</td>
              {series.map((s, si) => (
                <td key={s.name}>{stacks[i] ? pct(stacks[i]![si + 1]! - stacks[i]![si]!) : "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
