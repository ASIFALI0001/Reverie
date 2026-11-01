"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { niceMax } from "@/lib/admin/format";
import { cn } from "@/lib/cn";

/**
 * Small, quiet charts for the control room (the dataviz method): thin marks in the accent,
 * hairline grid, text in text tokens, a hover/focus readout on every mark, a table twin
 * one click away, and draw-in motion that reduced-motion turns off.
 */

const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// ── Stat tiles ──────────────────────────────────────────────────────────────

export function StatTile({ label, value, sub, hero = false }: { label: string; value: number; sub?: string; hero?: boolean }) {
  return (
    <div className={cn("border-t border-hairline-strong pt-4", hero && "col-span-2")}>
      <p className="text-meta text-muted">{label}</p>
      <p className={cn("mt-2 font-sans font-semibold leading-none tracking-[-0.02em] text-text", hero ? "text-[3.5rem]" : "text-[2rem]")}>
        {value.toLocaleString("en-GB")}
      </p>
      {sub ? <p className="mt-2 text-meta text-muted">{sub}</p> : null}
    </div>
  );
}

// ── Card with a table twin ──────────────────────────────────────────────────

export function ChartCard({
  title,
  sub,
  table,
  children,
  className,
}: {
  title: string;
  sub?: string;
  /** The accessible twin: the same numbers as a table. */
  table: { head: [string, string]; rows: [string, string][] };
  children: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("border-t border-hairline-strong pt-4", className)}>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 id={id} className="text-[1.375rem] leading-tight">
            {title}
          </h2>
          {sub ? <p className="mt-1 text-meta text-muted">{sub}</p> : null}
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="shrink-0 text-meta text-muted underline-offset-4 hover:text-text hover:underline"
        >
          {asTable ? "Chart" : "Table"}
        </button>
      </header>
      <div className="mt-5">
        {asTable ? (
          <table className="w-full text-[0.9375rem]">
            <thead>
              <tr className="border-b border-hairline text-left text-meta text-muted">
                <th className="py-2 font-normal">{table.head[0]}</th>
                <th className="py-2 text-right font-normal">{table.head[1]}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(([a, b]) => (
                <tr key={a} className="border-b border-hairline">
                  <td className="py-2">{a}</td>
                  <td className="py-2 text-right tabular-nums">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// ── Line (one series over time) ─────────────────────────────────────────────

type Point = { label: string; sub: string; value: number };

const PLOT_H = 180;
const AXIS_H = 26;
const PAD_L = 30;
const PAD_R = 14;

/**
 * One series over time: a 2px line in the accent over a 10% wash, a ringed end-dot with the
 * latest value, and a crosshair that snaps to the nearest point (pointer or arrow keys).
 */
export function LineChart({
  data,
  unit,
  ariaLabel,
  endNote,
}: {
  data: Point[];
  unit: [string, string];
  ariaLabel: string;
  /** Said after the latest value on the chart ("4 today"). */
  endNote?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  // Counts: gridlines only where the value is a whole number.
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const w = Math.max(0, width - PAD_L - PAD_R);
  const x = (i: number) => PAD_L + (data.length > 1 ? (i / (data.length - 1)) * w : w / 2);
  const y = (v: number) => PLOT_H - (v / max) * (PLOT_H - 8);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = `${line}L${x(data.length - 1).toFixed(1)},${PLOT_H}L${x(0).toFixed(1)},${PLOT_H}Z`;
  const last = data.length - 1;
  const word = (n: number) => (n === 1 ? unit[0] : unit[1]);

  const nearest = (clientX: number, left: number) => {
    const rel = clientX - left - PAD_L;
    return Math.max(0, Math.min(last, Math.round((rel / Math.max(1, w)) * last)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(last, (a ?? last) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setActive(null);
  };
  const shown = active;
  const readout = shown != null ? `${data[shown]!.value} ${word(data[shown]!.value)}, ${data[shown]!.sub}` : "";

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          width={width}
          height={PLOT_H + AXIS_H}
          className="block touch-none overflow-visible outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]"
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {/* Hairline grid. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--color-hairline-strong)" strokeWidth={1} />
              <text x={PAD_L - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--color-muted)] text-[0.6875rem] tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--color-accent)" fillOpacity={0.1} className="chart-fade" />
          <path d={line} pathLength={1} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="chart-draw" />
          {/* The latest point, labelled. */}
          <circle cx={x(last)} cy={y(data[last]!.value)} r={4} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} className="chart-fade" />
          <text x={x(last)} y={y(data[last]!.value) - 12} textAnchor="end" className="chart-fade fill-[var(--color-text)] text-[0.75rem] tabular-nums">
            {data[last]!.value}
            {endNote ? ` ${endNote}` : ""}
          </text>
          {/* Selective x labels: first, middle, last. */}
          {[0, Math.floor(last / 2), last].map((i) => (
            <text key={i} x={x(i)} y={PLOT_H + 18} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-[var(--color-muted)] text-[0.6875rem]">
              {data[i]!.label}
            </text>
          ))}
          {shown != null ? (
            <g pointerEvents="none">
              <line x1={x(shown)} x2={x(shown)} y1={0} y2={PLOT_H} stroke="var(--color-text)" strokeOpacity={0.35} strokeWidth={1} />
              <circle cx={x(shown)} cy={y(data[shown]!.value)} r={4} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height: PLOT_H + AXIS_H }} />
      )}
      {/* One live region, always mounted, so keyboard moves are announced. */}
      <p aria-live="polite" className="sr-only">
        {readout}
      </p>
      {shown != null && width > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 rounded-[4px] border border-hairline-strong bg-raised px-3 py-2 shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
          style={{ left: Math.min(Math.max(x(shown) - 70, 0), width - 140), width: 140 }}
        >
          <p className="text-[0.9375rem] text-text tabular-nums">
            {data[shown]!.value} {word(data[shown]!.value)}
          </p>
          <p className="text-meta text-muted">{data[shown]!.sub}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Bars (ranked categories) ────────────────────────────────────────────────

/**
 * Ranked categories as thin horizontal bars: rounded at the data end, square at the baseline,
 * value at the tip. Hover or focus shows each bar's share of `total`.
 */
export function BarList({
  data,
  unit,
  total,
  totalLabel,
}: {
  data: { label: string; value: number }[];
  unit: [string, string];
  total: number;
  /** "of saved titles" */
  totalLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const pct = (v: number) => `${Math.round((v / Math.max(total, 1)) * 100)}%`;
  const [active, setActive] = useState<number | null>(null);
  return (
    <ol className="space-y-2.5">
      {data.map((d, i) => (
        <li
          key={d.label}
          tabIndex={0}
          onPointerEnter={() => setActive(i)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(i)}
          onBlur={() => setActive(null)}
          aria-label={`${d.label}: ${d.value} ${d.value === 1 ? unit[0] : unit[1]}, ${pct(d.value)} ${totalLabel}`}
          className="group relative grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 rounded-[3px] outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          <span className="truncate text-[0.875rem] text-text">{d.label}</span>
          <span className="flex items-center gap-2">
            <span
              className="bar-grow h-3 rounded-r-[4px] bg-accent transition-[filter] group-hover:brightness-125"
              style={{ width: `${(d.value / max) * 82}%`, animationDelay: `${i * 50}ms` }}
            />
            <span className="text-meta text-muted tabular-nums">{d.value}</span>
          </span>
          {active === i ? (
            <span aria-hidden="true" className="pointer-events-none absolute -top-9 right-0 z-10 rounded-[4px] border border-hairline-strong bg-raised px-2.5 py-1.5 text-meta">
              <span className="text-text tabular-nums">{pct(d.value)}</span> <span className="text-muted">{totalLabel}</span>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
