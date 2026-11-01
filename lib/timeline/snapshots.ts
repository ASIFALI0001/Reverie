import { affinityScore } from "@/lib/reco/affinity";
import { normalize, weightedMean } from "@/lib/reco/vector";
import { ratingWeight, WEIGHTS } from "@/lib/reco/weights";
import type { TitleKey } from "@/lib/catalog/types";

/**
 * Monthly taste snapshots: what someone watched in a month, how they rated it, and where
 * their taste pointed. Pure, so it's tested directly; lib/timeline/build.ts feeds it.
 */

export type SnapshotItem = {
  key: TitleKey;
  /** When it was watched (or started / dropped). */
  at: Date;
  status: "watched" | "watching" | "dropped";
  /** 1–10, or null when unrated. */
  rating: number | null;
  title: string;
  posterPath: string | null;
  genres: string[];
  vibe: { pace: number; tone: number; complexity: number } | null;
  /** Minutes watched (a film's runtime; for series, an estimate). */
  minutes: number;
  embedding?: number[] | null;
};

export type TermValue = { term: string; value: number };

export type SnapshotData = {
  periodStart: Date;
  periodEnd: Date;
  count: number;
  hours: number;
  avgRating: number | null;
  genreShare: TermValue[];
  genreAffinity: TermValue[];
  vibe: { pace: number; tone: number; complexity: number } | null;
  vector: number[] | null;
  topTitles: { key: TitleKey; title: string; posterPath: string | null; rating: number | null }[];
  hash: string;
};

/** First instant of the item's month, UTC. */
export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function nextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** How much a library entry says about taste: the profile's own weights. */
export function itemWeight(i: Pick<SnapshotItem, "status" | "rating">): number {
  if (i.rating != null) return ratingWeight(i.rating);
  if (i.status === "dropped") return WEIGHTS.dropped;
  if (i.status === "watching") return WEIGHTS.watching;
  return WEIGHTS.watchedUnrated;
}

/** A short, stable fingerprint (FNV-1a) of a month's inputs, so unchanged months aren't rebuilt. */
export function hashInputs(items: Pick<SnapshotItem, "key" | "status" | "rating">[]): string {
  const text = [...items]
    .map((i) => `${i.key}:${i.status}:${i.rating ?? "-"}`)
    .sort()
    .join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const round = (x: number, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;

/** One snapshot per month that has anything in it, oldest first. */
export function buildSnapshots(items: SnapshotItem[]): SnapshotData[] {
  const byMonth = new Map<number, SnapshotItem[]>();
  for (const item of items) {
    const start = monthStart(item.at).getTime();
    byMonth.set(start, [...(byMonth.get(start) ?? []), item]);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a - b).map(([start, month]) => snapshotOf(new Date(start), month));
}

export function snapshotOf(periodStart: Date, items: SnapshotItem[]): SnapshotData {
  const rated = items.filter((i) => i.rating != null);
  const weights = items.map(itemWeight);

  // Genre share: each title spreads one vote across its genres.
  const share = new Map<string, number>();
  // Genre affinity: summed weight per genre, shrunk toward 0 when there's little evidence.
  const affinity = new Map<string, { sum: number; n: number }>();
  items.forEach((item, idx) => {
    for (const g of item.genres) {
      share.set(g, (share.get(g) ?? 0) + 1 / item.genres.length);
      const a = affinity.get(g) ?? { sum: 0, n: 0 };
      affinity.set(g, { sum: a.sum + weights[idx]!, n: a.n + 1 });
    }
  });
  const shareTotal = [...share.values()].reduce((a, b) => a + b, 0) || 1;

  // Vibe and direction lean on what they liked; a month of dislikes still has a (weak) vibe.
  const positive = items.map((_, idx) => Math.max(0.15, weights[idx]!));
  const withVibe = items.flatMap((item, idx) => (item.vibe ? [{ vibe: item.vibe, w: positive[idx]! }] : []));
  const vibeWeight = withVibe.reduce((a, v) => a + v.w, 0);
  const vibe = vibeWeight
    ? {
        pace: round(withVibe.reduce((a, v) => a + v.vibe.pace * v.w, 0) / vibeWeight),
        tone: round(withVibe.reduce((a, v) => a + v.vibe.tone * v.w, 0) / vibeWeight),
        complexity: round(withVibe.reduce((a, v) => a + v.vibe.complexity * v.w, 0) / vibeWeight),
      }
    : null;

  const embedded = items.flatMap((item, idx) => (item.embedding?.length ? [{ v: item.embedding, w: positive[idx]! }] : []));
  const vector = embedded.length
    ? normalize(weightedMean(embedded.map((e) => e.v), embedded.map((e) => e.w))).map((x) => round(x, 5))
    : null;

  const topTitles = [...items]
    .sort((a, b) => (b.rating ?? itemWeight(b) * 10) - (a.rating ?? itemWeight(a) * 10) || b.at.getTime() - a.at.getTime())
    .slice(0, 5)
    .map((i) => ({ key: i.key, title: i.title, posterPath: i.posterPath, rating: i.rating }));

  return {
    periodStart,
    periodEnd: nextMonth(periodStart),
    count: items.length,
    hours: round(items.reduce((a, i) => a + i.minutes, 0) / 60, 1),
    avgRating: rated.length ? round(rated.reduce((a, i) => a + i.rating!, 0) / rated.length, 2) : null,
    genreShare: [...share.entries()]
      .map(([term, v]) => ({ term, value: round(v / shareTotal) }))
      .sort((a, b) => b.value - a.value),
    genreAffinity: [...affinity.entries()]
      .map(([term, a]) => ({ term, value: round(affinityScore(a.sum, a.n)) }))
      .sort((a, b) => b.value - a.value),
    vibe,
    vector,
    topTitles,
    hash: hashInputs(items),
  };
}
