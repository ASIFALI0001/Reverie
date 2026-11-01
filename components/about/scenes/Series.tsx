"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { ShieldCheck } from "@phosphor-icons/react";
import { useGsapScene } from "@/components/about/useGsapScene";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { SceneProps } from "@/components/about/types";

const H = 180;
const PAD = { l: 28, r: 8, t: 22, b: 26 };
const STEP = 12;
const GAP = 16;
const HERE = { season: 1, episode: 4 };
const y = (r: number) => PAD.t + (1 - (Math.max(5, Math.min(10, r)) - 5) / 5) * (H - PAD.t - PAD.b);

/**
 * 09 · Should I keep going? Breaking Bad's real episode ratings, season by season. The line draws
 * itself, a marker travels along it to "you are here" (S1E4: a motion path, computed along the
 * line), then the verdict stamps down and the Spoiler shield glints. Phones: plays on arrival.
 * Reduced motion: the finished chart and verdict.
 */
export default function Series({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const seasons = data?.series ?? [];

  // Lay out every rated episode left to right; one path through all of them.
  const points: { x: number; y: number; s: number; e: number }[] = [];
  let x = PAD.l;
  const labels: { x: number; s: number; avg: number | null }[] = [];
  for (const s of seasons) {
    labels.push({ x, s: s.season, avg: s.avg });
    for (const e of s.episodes) {
      if (e.rating != null) points.push({ x: x + STEP / 2, y: y(e.rating), s: s.season, e: e.episode });
      x += STEP;
    }
    x += GAP;
  }
  const W = Math.max(x, 320);
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  const hereIdx = Math.max(0, points.findIndex((p) => p.s === HERE.season && p.e === HERE.episode));
  const here = points[hereIdx];

  useGsapScene(ref, !reduced && points.length > 1, wide ? "wide" : "narrow", ({ gsap }, root, el) => {
    const line = el.querySelector<SVGPathElement>("[data-line]")!;
    const marker = el.querySelector<SVGGElement>("[data-marker]")!;
    // Distance along the line to "you are here", so the marker can ride the path itself.
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
    const target = lengths[hereIdx]!;
    const ride = { d: 0 };
    const place = () => {
      const pt = line.getPointAtLength(ride.d);
      marker.setAttribute("transform", `translate(${pt.x},${pt.y})`);
    };
    gsap.set(line, { strokeDasharray: lengths.at(-1)!, strokeDashoffset: lengths.at(-1)! });
    gsap.set(el.querySelectorAll("[data-ahead]"), { opacity: 0 });
    gsap.set(el.querySelector("[data-stamp]"), { opacity: 0, scale: 1.7, rotate: -14 });
    gsap.set(el.querySelector("[data-here]"), { opacity: 0 });
    place();
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: wide
        ? { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 }
        : { trigger: el, start: "top 70%", toggleActions: "play none none none" },
    });
    tl.to(line, { strokeDashoffset: 0, duration: 0.45, ease: "power1.inOut" }, 0)
      .to(el.querySelectorAll("[data-ahead]"), { opacity: 1, duration: 0.2, stagger: 0.002 }, 0.15)
      .to(ride, { d: target, duration: 0.25, ease: "power2.inOut", onUpdate: place }, 0.4)
      .to(el.querySelector("[data-here]"), { opacity: 1, duration: 0.06 }, 0.62)
      .to(el.querySelector("[data-stamp]"), { opacity: 1, scale: 1, rotate: -4, duration: 0.1, ease: "back.out(2)" }, 0.7)
      .fromTo(el.querySelector("[data-glint]"), { backgroundPosition: "-120% 0" }, { backgroundPosition: "220% 0", duration: 0.15 }, 0.82)
      .to({}, { duration: 0.06 });
    if (!wide) tl.timeScale(0.22);
  });

  return (
    <div ref={ref} className="mx-auto w-full max-w-4xl">
      {/* Labels are larger in viewBox units below lg, where the chart is drawn smaller. */}
      <div className="overflow-x-auto pb-2" data-lenis-prevent>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[40rem] overflow-visible" role="img" aria-label={`Breaking Bad episode ratings by season; you are at season ${HERE.season}, episode ${HERE.episode}.`}>
          {[6, 8, 10].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-hairline)" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--color-muted)] text-[12px] lg:text-[9px]">
                {v}
              </text>
            </g>
          ))}
          {labels.map((l) => (
            <text key={l.s} x={l.x} y={H - 6} className="fill-[var(--color-muted)] text-[12px] lg:text-[9px]">
              S{l.s}
              {l.avg != null ? ` · ${l.avg}` : ""}
            </text>
          ))}
          <path data-line d={path} fill="none" stroke="var(--color-text)" strokeOpacity={0.35} strokeWidth={2} strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={`${p.s}-${p.e}`} data-ahead={i > hereIdx ? "" : undefined} cx={p.x} cy={p.y} r={3.2} fill={i > hereIdx ? "var(--color-accent)" : "var(--color-muted)"} stroke="var(--color-surface)" strokeWidth={1.5} />
          ))}
          {here ? (
            <>
              <g data-here>
                <line x1={here.x} x2={here.x} y1={PAD.t - 8} y2={H - PAD.b + 4} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" />
                <text x={here.x} y={PAD.t - 12} textAnchor="middle" className="fill-[var(--color-text)] text-[12px] lg:text-[9px]">
                  You are here · S{HERE.season}E{HERE.episode}
                </text>
              </g>
              <g data-marker transform={`translate(${here.x},${here.y})`}>
                <circle r={6} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
              </g>
            </>
          ) : null}
        </svg>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <p data-stamp className="origin-left font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-none">
          Give it till S1E6
        </p>
        <span className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-hairline-strong px-3 py-1 text-[0.875rem]">
          <ShieldCheck size={15} weight="fill" className="text-accent" aria-hidden="true" /> Spoiler shield
          <span data-glint aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.35)_50%,transparent_65%)] bg-[length:200%_100%] bg-no-repeat" style={{ backgroundPosition: "-120% 0" }} />
        </span>
      </div>
    </div>
  );
}
