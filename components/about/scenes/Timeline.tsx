"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MorphRadar } from "@/components/taste/MorphRadar";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { RADAR_AXES } from "@/lib/reco/affinity";
import type { RadarPoint } from "@/lib/taste/types";

import { ease } from "@/lib/motion";

// Three eras of one imagined viewer, on the real radar axes.
const ERAS = [
  { name: "The Marvel phase", when: "2023", values: [0.92, 0.7, 0.45, 0.35, 0.2, 0.55, 0.85, 0.5] },
  { name: "Into mind-bending thrillers", when: "2024", values: [0.5, 0.35, 0.7, 0.3, 0.4, 0.92, 0.88, 0.2] },
  { name: "The slow-cinema winter", when: "Winter 2025", values: [0.25, 0.45, 0.95, 0.7, 0.15, 0.5, 0.4, 0.3] },
];
// Where on the scrubbed timeline each later era takes the focus (halfway through its morph).
const ERA_TURNS = [0.22, 0.57];
const AXES = RADAR_AXES.map((a) => a.axis);
const pts = (values: number[]): RadarPoint[] => values.map((value, i) => ({ axis: AXES[i]!, value, evidence: 5 }));

const C = 100;
const R = 78;
const at = (i: number, v: number) => {
  const a = -Math.PI / 2 + (i / AXES.length) * Math.PI * 2;
  return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v] as const;
};
const ring = (vals: number[]) => vals.map((v, i) => at(i, Math.max(0.04, v)).map((n) => n.toFixed(1)).join(",")).join(" ");

/**
 * 11 · Taste DNA timeline. One radar, its shape morphing continuously from era to era as you
 * scroll (the vertices are interpolated between the eras' shapes), while the era names light up
 * in big serif italic. At the end the share card drops in like a print. Phones and reduced
 * motion: the eras as a list, each radar growing out of the one before (the real component).
 */
export default function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);

  useGsapScene(ref, wide && !reduced, "wide", ({ gsap }, root, el) => {
    const poly = el.querySelector<SVGPolygonElement>("[data-shape]")!;
    // The era in focus in full ink, the others in muted ink (still readable, never faded out). The
    // ink changes by attribute and CSS transition, so it follows the theme.
    const names = [...el.querySelectorAll<HTMLElement>("[data-era-name]")];
    const morph = { t: 0 };
    const draw = () => {
      const k = Math.min(ERAS.length - 2, Math.floor(morph.t));
      const f = morph.t - k;
      const vals = ERAS[k]!.values.map((v, i) => v + (ERAS[k + 1]!.values[i]! - v) * f);
      poly.setAttribute("points", ring(vals));
    };
    draw();
    gsap.set(el.querySelector("[data-print]"), { opacity: 0, y: -140, rotate: -14 });
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.7 },
      onUpdate: () => {
        const now = ERA_TURNS.filter((at) => tl.time() >= at).length;
        names.forEach((n, i) => n.toggleAttribute("data-current", i === now));
      },
    });
    tl.to(morph, { t: 1, duration: 0.3, ease: "power1.inOut", onUpdate: draw }, 0.08)
      .to(morph, { t: 2, duration: 0.3, ease: "power1.inOut", onUpdate: draw }, 0.42)
      .to(el.querySelector("[data-print]"), { opacity: 1, y: 0, rotate: -3, duration: 0.16, ease: "back.out(1.4)" }, 0.8)
      .to({}, { duration: 0.06 });
  });

  if (!wide || reduced) {
    return (
      <div className="w-full lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center lg:gap-16">
        <ol className="space-y-10">
          {ERAS.map((e, i) => (
            <li key={e.name} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-5">
              <MorphRadar points={pts(e.values)} from={i ? pts(ERAS[i - 1]!.values) : null} when="view" labels={false} label={`${e.name}, genre radar`} />
              <div>
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{e.when}</p>
                <p className="mt-1 font-display text-[1.75rem] italic leading-tight">{e.name}</p>
              </div>
            </li>
          ))}
        </ol>
        <motion.div className="mt-10 lg:mt-0" initial={reduced ? false : { opacity: 0, y: -60, rotate: -10 }} whileInView={{ opacity: 1, y: 0, rotate: -3 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.9, ease: ease.out }}>
          <ShareCard />
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={ref} className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,22rem)_minmax(0,14rem)] items-center gap-10">
      <ol>
        {ERAS.map((e, i) => (
          <li key={e.name} className="py-3">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{e.when}</p>
            <p
              data-era-name
              data-current={i === 0 ? "" : undefined}
              className="mt-1 font-display text-[clamp(2rem,3.2vw,3rem)] italic leading-[1.02] text-muted transition-colors duration-500 data-current:text-text"
            >
              {e.name}
            </p>
          </li>
        ))}
      </ol>
      <svg viewBox="-30 -14 260 228" role="img" aria-label="Genre radar morphing between the eras" className="w-full overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon key={r} points={ring(AXES.map(() => r))} fill="none" stroke={r === 0.5 ? "var(--color-hairline-strong)" : "var(--color-hairline)"} strokeWidth={1} />
        ))}
        {AXES.map((a, i) => {
          const [x, y] = at(i, 1.18);
          return (
            <text key={a} x={x} y={y} dy="0.35em" textAnchor={Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end"} className="fill-[var(--color-muted)] text-[11px]">
              {a}
            </text>
          );
        })}
        <polygon data-shape points={ring(ERAS[0]!.values)} fill="var(--color-accent)" fillOpacity={0.15} stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <div data-print>
        <ShareCard />
      </div>
    </div>
  );
}

/** A small likeness of the story share card (the real one is made by /api/taste/card). */
function ShareCard() {
  const last = ERAS.at(-1)!;
  return (
    <div className="mx-auto w-[12rem] rounded-[6px] border border-hairline-strong bg-[radial-gradient(circle_at_80%_8%,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent_55%)] bg-bg p-4 shadow-[0_30px_70px_rgb(0_0_0/0.5)]">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-[1rem] text-accent">Reverie</p>
        <p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted">My taste</p>
      </div>
      <svg viewBox="-10 -6 220 212" aria-hidden="true" className="mt-3 w-full">
        <polygon points={ring(AXES.map(() => 1))} fill="none" stroke="var(--color-hairline)" strokeWidth={1.5} />
        <polygon points={ring(last.values)} fill="var(--color-accent)" fillOpacity={0.16} stroke="var(--color-accent)" strokeWidth={3} strokeLinejoin="round" />
      </svg>
      <ul className="mt-2 border-t border-hairline text-[0.8125rem] font-display leading-snug">
        {["Patient with a slow burn", "Heart over spectacle", "Quietly into romance"].map((p) => (
          <li key={p} className="border-b border-hairline py-1.5">
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted">And every December: your year, wrapped</p>
    </div>
  );
}
