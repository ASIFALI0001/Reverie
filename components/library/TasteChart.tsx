"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ease } from "@/lib/motion";

type Month = { month: string; added: number; avgRating: number | null };

const W = 12 * 22;
const H = 64;
const BAR = 14;

/**
 * "Taste over time": titles per month for the last year. One series → one mark
 * colour; the current month in the accent. Every value is also in the hidden
 * table, so the tooltip enhances rather than gates.
 */
export function TasteChart({ months }: { months: Month[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.added));
  const peak = months.reduce((best, m, i) => (m.added > (months[best]?.added ?? 0) ? i : best), 0);
  const label = (m: Month) => new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const shown = active != null ? months[active] : null;

  return (
    <figure className="relative">
      <figcaption className="text-meta text-muted">Titles per month</figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H + 16}`} className="block w-full max-w-[22rem] overflow-visible" role="group" aria-label="Titles added per month over the last year">
          <line x1="0" x2={W} y1={H} y2={H} stroke="var(--color-hairline-strong)" strokeWidth="1" />
          {months.map((m, i) => {
            const h = m.added === 0 ? 0 : Math.max(3, (m.added / max) * (H - 14));
            const x = i * 22 + (22 - BAR) / 2;
            const current = i === months.length - 1;
            return (
              <g
                key={m.month}
                tabIndex={0}
                role="img"
                aria-label={`${label(m)}: ${m.added} titles${m.avgRating ? `, average rating ${m.avgRating}` : ""}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              >
                {/* Hit target wider than the mark. */}
                <rect x={i * 22} y={0} width={22} height={H} fill="transparent" />
                <motion.path
                  d={columnPath(x, H, BAR, h)}
                  fill={current ? "var(--color-accent)" : active === i ? "var(--color-text)" : "var(--color-muted)"}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.9, ease: ease.out, delay: 0.2 + i * 0.04 }}
                  style={{ transformOrigin: `${x + BAR / 2}px ${H}px`, transformBox: "view-box" }}
                />
                {i % 3 === 0 || current ? (
                  <text x={x + BAR / 2} y={H + 13} textAnchor="middle" className="fill-[var(--color-muted)] text-[8px]">
                    {new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "narrow" })}
                  </text>
                ) : null}
                {i === peak && m.added > 0 && active == null ? (
                  <text x={x + BAR / 2} y={H - h - 4} textAnchor="middle" className="numeral fill-[var(--color-text)] text-[8px]">
                    {m.added}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {shown ? (
          <div className="pointer-events-none absolute -top-12 left-0 rounded-[var(--radius-panel)] border border-hairline-strong bg-raised px-3 py-2 text-meta">
            <span className="numeral text-text">{shown.added}</span>
            <span className="text-muted"> titles · {label(shown)}</span>
            {shown.avgRating ? <span className="text-muted"> · avg {shown.avgRating}</span> : null}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>Titles added per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Titles</th>
            <th scope="col">Average rating</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{label(m)}</th>
              <td>{m.added}</td>
              <td>{m.avgRating ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Column with a 4px rounded top and a square base on the baseline. */
function columnPath(x: number, baseline: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  const top = baseline - h;
  return `M${x},${baseline}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${baseline}Z`;
}
