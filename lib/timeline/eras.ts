import { radarFrom } from "@/lib/reco/affinity";
import type { RadarPoint } from "@/lib/taste/types";
import type { SnapshotData, TermValue } from "@/lib/timeline/snapshots";

/**
 * Taste eras: stretches of months where what you watched held steady. Pure, so it's tested
 * directly; lib/timeline/timeline.ts feeds it the stored monthly snapshots.
 *
 * Each month is its genre mix (every title spreads one vote across its genres). The eras are the
 * split of your history that best explains it: an era's misfit is how far its months' mixes sit
 * from the era's own mix (squared, weighted by titles), and every era costs a fixed `penalty`,
 * so a new era has to earn its place. Solved exactly (dynamic programming over where eras start).
 *
 * Why genre mixes, judged over whole eras: tuned in .qa/tmp/era-tune.ts on real catalog titles,
 * with viewers simulated from genre tastes. Title embeddings were tried first, a month at a time:
 * two completely different tastes sit only ~0.03 apart (1 − cosine) while a month strays about
 * 0.2 ÷ its number of titles, so single months can't tell a turn from noise (and embeddings
 * pooled over eras still trailed genre mixes). With penalty 0.9 and the boundary check below,
 * over 500 simulated years per case:
 *                                              1–8 titles a month   1–3 (light loggers)
 *   steady year → 1 era                              98.8%                97.0%
 *   turns mid-year → 2 eras                          98.6%                88.0%
 *   turns in its last two months → 2                 87.6%                45.6%
 *   turns, then back after four months → 3           88.0%                25.2%
 *   one odd month → folded in                        90.0%                95.4%
 *   an odd latest month → folded in                  91.4%                91.8%
 * Short phases need more evidence than light logging leaves. A missed phase only merges into a
 * broader era; an invented one tells a false story, so the penalty leans that way.
 */

export type MonthInput = Pick<SnapshotData, "periodStart" | "periodEnd" | "count" | "hours" | "avgRating" | "genreShare" | "genreAffinity" | "vibe" | "topTitles" | "hash">;

export const ERA_RULES = {
  /** What one more era costs, in the units of the misfit above. */
  penalty: 0.9,
  /** Fewest months with something logged that make an era: one odd month never does. */
  minMonths: 2,
  maxEras: 8,
};

export type Era = {
  start: Date;
  end: Date;
  /** Months with something in them. */
  months: number;
  count: number;
  hours: number;
  avgRating: number | null;
  /** Share of the era's titles per genre, largest first (top 6). */
  genres: TermValue[];
  radar: RadarPoint[];
  vibe: { pace: number; tone: number; complexity: number } | null;
  topTitles: MonthInput["topTitles"];
  /** How much of the genre mix changed from the era before (0–1, total variation); null for the first. */
  shift: number | null;
  /** Fingerprint of the months inside, so names are only regenerated when an era changes. */
  hash: string;
};

const round = (x: number, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;

/**
 * Optimal partition of points (in order) into runs of at least `minMonths`, at most `maxEras` of
 * them, minimising Σ over runs of Σ n·‖x − run mean‖² plus `penalty` per run. Returns where each
 * run starts. Prefix sums make any run's misfit O(dimensions): Σn‖x‖² − ‖Σn·x‖² / Σn.
 */
export function partition(points: { x: number[]; n: number }[], { penalty, minMonths, maxEras }: typeof ERA_RULES): number[] {
  const M = points.length;
  if (!M) return [];
  const D = points[0]!.x.length;
  const S1 = [new Float64Array(D)];
  const S2 = [0];
  const N = [0];
  for (const p of points) {
    const next = Float64Array.from(S1.at(-1)!);
    let sq = 0;
    for (let d = 0; d < D; d++) {
      next[d]! += p.n * p.x[d]!;
      sq += p.x[d]! ** 2;
    }
    S1.push(next);
    S2.push(S2.at(-1)! + p.n * sq);
    N.push(N.at(-1)! + p.n);
  }
  const misfit = (i: number, j: number) => {
    const n = N[j]! - N[i]!;
    if (n <= 0) return 0;
    let sq = 0;
    for (let d = 0; d < D; d++) sq += (S1[j]![d]! - S1[i]![d]!) ** 2;
    return Math.max(0, S2[j]! - S2[i]! - sq / n);
  };

  const K = Math.max(1, Math.min(maxEras, Math.floor(M / minMonths)));
  const best = Array.from({ length: K + 1 }, () => new Float64Array(M + 1).fill(Infinity));
  const from = Array.from({ length: K + 1 }, () => new Int32Array(M + 1));
  best[0]![0] = 0;
  for (let k = 1; k <= K; k++) {
    for (let j = k * minMonths; j <= M; j++) {
      for (let i = (k - 1) * minMonths; i <= j - minMonths; i++) {
        const v = best[k - 1]![i]! + misfit(i, j);
        if (v < best[k]![j]!) {
          best[k]![j] = v;
          from[k]![j] = i;
        }
      }
    }
  }
  // Fewer months than one era's minimum: they're one era all the same.
  if (best[1]![M] === Infinity) best[1]![M] = misfit(0, M);
  let k = 1;
  for (let c = 2; c <= K; c++) if (best[c]![M]! + penalty * c < best[k]![M]! + penalty * k - 1e-9) k = c;

  const starts: number[] = [];
  for (let j = M; k >= 1; k--) {
    const i = k === 1 ? 0 : from[k]![j]!;
    starts.unshift(i);
    j = i;
  }
  return starts;
}

/**
 * Boundaries go where the months say: a month at the edge of an era that sits closer to the
 * neighbouring era's mix belongs to that era. The boundary moves, or the two eras merge when
 * moving it would leave one shorter than `minMonths` (a steady run ending in one odd month is
 * otherwise split as [S S][S H], the odd month dragging a neighbour along). Never adds eras.
 */
export function refine(points: { x: number[]; n: number }[], starts: number[], minMonths: number): number[] {
  const s = [...starts];
  const mixOf = (i: number, j: number) => {
    const D = points[0]!.x.length;
    const sum = new Array<number>(D).fill(0);
    let n = 0;
    for (let m = i; m < j; m++) {
      n += points[m]!.n;
      for (let d = 0; d < D; d++) sum[d]! += points[m]!.n * points[m]!.x[d]!;
    }
    return n ? sum.map((v) => v / n) : null;
  };
  const d2 = (x: number[], mix: number[] | null) => (mix ? x.reduce((a, v, d) => a + (v - mix[d]!) ** 2, 0) : Infinity);
  for (let guard = 0, moved = true; moved && guard < 4 * points.length; guard++) {
    moved = false;
    for (let e = 1; e < s.length && !moved; e++) {
      const [a, b, end] = [s[e - 1]!, s[e]!, s[e + 1] ?? points.length];
      const [mixA, mixB] = [mixOf(a, b), mixOf(b, end)];
      const first = points[b]!;
      const last = points[b - 1]!;
      if (first.n && d2(first.x, mixA) < d2(first.x, mixB)) {
        if (end - (b + 1) >= minMonths) s[e] = b + 1;
        else s.splice(e, 1);
        moved = true;
      } else if (last.n && d2(last.x, mixB) < d2(last.x, mixA)) {
        if (b - 1 - a >= minMonths) s[e] = b - 1;
        else s.splice(e, 1);
        moved = true;
      }
    }
  }
  return s;
}

/** Each month's genre mix over every genre seen, so months compare like for like. */
function genreMixes(months: MonthInput[]) {
  const vocab = [...new Set(months.flatMap((m) => m.genreShare.map((s) => s.term)))];
  return {
    vocab,
    points: months.map((m) => {
      const of = new Map(m.genreShare.map((s) => [s.term, s.value]));
      // A month with no genres (nothing in it is catalogued yet) carries no weight.
      return { x: vocab.map((g) => of.get(g) ?? 0), n: m.genreShare.length ? m.count : 0 };
    }),
  };
}

export function detectEras(input: MonthInput[], rules = ERA_RULES): Era[] {
  const months = [...input].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  if (!months.length) return [];
  const { points } = genreMixes(months);
  const starts = refine(points, partition(points, rules), rules.minMonths);
  const groups = starts.map((s, i) => months.slice(s, starts[i + 1] ?? months.length));
  return groups.map((g, i) => eraOf(g, i ? groups[i - 1]! : null));
}

/** The era's genre mix: each month's shares weighted by how much was watched. */
function mixOf(ms: MonthInput[]) {
  const share = new Map<string, number>();
  for (const m of ms) for (const s of m.genreShare) share.set(s.term, (share.get(s.term) ?? 0) + s.value * m.count);
  const total = [...share.values()].reduce((a, b) => a + b, 0) || 1;
  return new Map([...share.entries()].map(([g, v]) => [g, v / total]));
}

function eraOf(ms: MonthInput[], previous: MonthInput[] | null): Era {
  const count = ms.reduce((a, m) => a + m.count, 0);
  const mix = mixOf(ms);
  let shift: number | null = null;
  if (previous) {
    const before = mixOf(previous);
    const genres = new Set([...mix.keys(), ...before.keys()]);
    shift = round([...genres].reduce((a, g) => a + Math.abs((mix.get(g) ?? 0) - (before.get(g) ?? 0)), 0) / 2);
  }

  const affinity = new Map<string, { sum: number; w: number }>();
  for (const m of ms) {
    const weightOf = new Map(m.genreShare.map((s) => [s.term, s.value * m.count]));
    for (const a of m.genreAffinity) {
      const w = weightOf.get(a.term) ?? 0;
      if (!w) continue;
      const cur = affinity.get(a.term) ?? { sum: 0, w: 0 };
      affinity.set(a.term, { sum: cur.sum + a.value * w, w: cur.w + w });
    }
  }

  const rated = ms.filter((m) => m.avgRating != null);
  const ratedWeight = rated.reduce((a, m) => a + m.count, 0);
  const withVibe = ms.filter((m) => m.vibe);
  const vibeWeight = withVibe.reduce((a, m) => a + m.count, 0);
  const vibeAvg = (k: "pace" | "tone" | "complexity") => round(withVibe.reduce((a, m) => a + m.vibe![k] * m.count, 0) / vibeWeight);

  const seen = new Set<string>();
  const topTitles = ms
    .flatMap((m) => m.topTitles)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)))
    .slice(0, 5);

  return {
    start: ms[0]!.periodStart,
    end: ms.at(-1)!.periodEnd,
    months: ms.length,
    count,
    hours: round(ms.reduce((a, m) => a + m.hours, 0), 1),
    avgRating: ratedWeight ? round(rated.reduce((a, m) => a + m.avgRating! * m.count, 0) / ratedWeight, 2) : null,
    genres: [...mix.entries()]
      .map(([term, v]) => ({ term, value: round(v) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    radar: radarFrom([...affinity.entries()].map(([term, a]) => ({ term, value: a.sum / a.w, n: Math.max(1, Math.round(a.w)) }))),
    vibe: vibeWeight ? { pace: vibeAvg("pace"), tone: vibeAvg("tone"), complexity: vibeAvg("complexity") } : null,
    topTitles,
    shift,
    hash: fnv(ms.map((m) => `${m.periodStart.toISOString().slice(0, 7)}:${m.hash}`).join("|")),
  };
}

/** FNV-1a, hex. */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ── Genre share over time (the stacked chart) ────────────────────────────────

export type GenreMonth = { start: Date; count: number; shares: number[] | null };

/**
 * The top `k` genres overall, then every calendar month from the first to the last with each
 * one's share (and "Other" last). Months with nothing watched are kept, with `shares: null`,
 * so the chart shows the gap instead of quietly closing it.
 */
export function genreSeries(input: MonthInput[], k = 5): { genres: string[]; months: GenreMonth[] } {
  const months = [...input].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  if (!months.length) return { genres: [], months: [] };
  const totals = new Map<string, number>();
  for (const m of months) for (const s of m.genreShare) totals.set(s.term, (totals.get(s.term) ?? 0) + s.value * m.count);
  const genres = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([g]) => g);

  const byStart = new Map(months.map((m) => [m.periodStart.getTime(), m]));
  const out: GenreMonth[] = [];
  const first = months[0]!.periodStart;
  const last = months.at(-1)!.periodStart;
  for (let d = first; d.getTime() <= last.getTime(); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const m = byStart.get(d.getTime());
    if (!m) {
      out.push({ start: d, count: 0, shares: null });
      continue;
    }
    const of = new Map(m.genreShare.map((s) => [s.term, s.value]));
    const main = genres.map((g) => round(of.get(g) ?? 0));
    out.push({ start: d, count: m.count, shares: [...main, round(Math.max(0, 1 - main.reduce((a, b) => a + b, 0)))] });
  }
  return { genres, months: out };
}

// ── Words, for when the model isn't available ────────────────────────────────

const GENRE_WORD: Record<string, string> = {
  "Science Fiction": "sci-fi",
  "Sci-Fi & Fantasy": "sci-fi",
  "Action & Adventure": "action",
  "War & Politics": "war",
  "TV Movie": "TV movie",
  Documentary: "documentary",
};
export const genreWord = (g: string) => GENRE_WORD[g] ?? g.toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sci-fi and thriller phase": plain, but never wrong. */
export function fallbackEraName(era: Pick<Era, "genres">): string {
  const [a, b] = era.genres.map((g) => genreWord(g.term)).filter((w, i, all) => all.indexOf(w) === i);
  if (!a) return "A quiet phase";
  return `${cap(a)}${b ? ` and ${b}` : ""} phase`;
}

export function fallbackEraLine(era: Pick<Era, "count" | "months" | "genres" | "vibe">): string {
  const words = era.genres.slice(0, 2).map((g) => genreWord(g.term));
  const lean = era.vibe
    ? // Vibe scales: pace 0 slow-burn … 1 fast; tone 0 light … 1 dark.
      [era.vibe.pace <= 0.38 ? "slow" : era.vibe.pace >= 0.65 ? "fast" : null, era.vibe.tone >= 0.65 ? "dark" : era.vibe.tone <= 0.35 ? "light" : null].filter(Boolean)
    : [];
  return `${era.count} title${era.count === 1 ? "" : "s"} over ${era.months} month${era.months === 1 ? "" : "s"}${words.length ? `, mostly ${words.join(" and ")}` : ""}${lean.length ? `, leaning ${lean.join(" and ")}` : ""}.`;
}
