import "server-only";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { titlesCol } from "@/lib/db/titles";
import { titleHref } from "@/lib/catalog/links";
import { parseTitleKey, type TitleKey } from "@/lib/catalog/types";
import { getFreshProfile, toTasteView } from "@/lib/reco/taste";
import { getTimeline } from "@/lib/timeline/timeline";
import { genreWord } from "@/lib/timeline/eras";

/**
 * Wrapped: a date range of your viewing as a story. Everything comes from your own library
 * (what you logged in the range, when you say you watched it) plus your eras and Taste DNA.
 */

type Card = { key: TitleKey; title: string; posterPath: string | null; href: string | null };

export type WrappedView = {
  range: { from: string; to: string; label: string };
  titles: number;
  hours: number;
  films: number;
  series: number;
  avgRating: number | null;
  topGenres: { term: string; word: string; share: number }[];
  favourites: (Card & { rating: number })[];
  first: (Card & { at: string }) | null;
  months: { start: string; count: number }[];
  busiest: { start: string; count: number } | null;
  eras: { name: string; start: string; end: string }[];
  vibe: { pace: number; tone: number; complexity: number } | null;
  feel: string[];
  dna: string[];
};

const DAY = 86_400_000;
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

/** "2026" for a whole calendar year, "2026 so far" up to today, otherwise "Mar 2026 – Oct 2026" (or one month). */
export function rangeLabel(from: Date, to: Date, today = new Date()): string {
  if (from.getUTCMonth() === 0 && from.getUTCDate() === 1 && from.getUTCFullYear() === to.getUTCFullYear()) {
    if (to.getUTCMonth() === 11 && to.getUTCDate() === 31) return String(from.getUTCFullYear());
    if (to.toISOString().slice(0, 10) >= today.toISOString().slice(0, 10)) return `${from.getUTCFullYear()} so far`;
  }
  const a = fmt(from, { month: "short", year: "numeric" });
  const b = fmt(to, { month: "short", year: "numeric" });
  return a === b ? a : `${a} – ${b}`;
}

/** Vibe scales: pace 0 slow-burn … 1 fast; tone 0 light … 1 dark; complexity 0 easy … 1 demanding. */
export function feelWords(v: { pace: number; tone: number; complexity: number }): string[] {
  return [
    v.pace <= 0.38 ? "slow-burning" : v.pace >= 0.65 ? "fast" : null,
    v.tone >= 0.65 ? "dark" : v.tone <= 0.35 ? "light" : "bittersweet",
    v.complexity >= 0.62 ? "demanding" : v.complexity <= 0.35 ? "easy-going" : null,
  ].filter((w): w is string => !!w);
}

export async function getWrapped(uid: string, from: Date, to: Date): Promise<WrappedView> {
  await connectDb();
  const end = new Date(to.getTime() + DAY); // inclusive of the last day
  const items = await LibraryItem.find(
    {
      uid,
      status: { $in: ["watched", "watching", "dropped"] },
      $or: [{ watchedAt: { $gte: from, $lt: end } }, { watchedAt: null, addedAt: { $gte: from, $lt: end } }],
    },
    { key: 1, status: 1, rating: 1, watchedAt: 1, addedAt: 1 },
  ).lean();
  const titles = await titlesCol();
  const docs = await titles
    .find({ _id: { $in: items.map((i) => i.key as TitleKey) } }, { projection: { title: 1, posterPath: 1, genres: 1, vibe: 1, runtime: 1, episodes: 1, mediaType: 1 } })
    .toArray();
  const byKey = new Map(docs.map((d) => [d._id, d]));
  const entries = items.flatMap((i) => {
    const d = byKey.get(i.key as TitleKey);
    return d ? [{ ...i, at: (i.watchedAt ?? i.addedAt)!, doc: d }] : [];
  });
  const card = (key: TitleKey, d: (typeof docs)[number]): Card => {
    const k = parseTitleKey(key);
    return { key, title: d.title, posterPath: d.posterPath ?? null, href: k ? titleHref(k.mediaType, k.tmdbId, d.title) : null };
  };

  // Genres: each title spreads one vote across its genres.
  const votes = new Map<string, number>();
  for (const e of entries) for (const g of e.doc.genres ?? []) votes.set(g, (votes.get(g) ?? 0) + 1 / e.doc.genres.length);
  const voteTotal = [...votes.values()].reduce((a, b) => a + b, 0) || 1;

  const rated = entries.filter((e) => e.rating != null);
  // What they liked (or didn't rate) sets the feel; what they turned away from doesn't.
  const liked = entries.filter((e) => e.doc.vibe && e.status !== "dropped" && (e.rating ?? 7) >= 7);
  const vibe = liked.length
    ? {
        pace: round(liked.reduce((a, e) => a + e.doc.vibe!.pace, 0) / liked.length, 2),
        tone: round(liked.reduce((a, e) => a + e.doc.vibe!.tone, 0) / liked.length, 2),
        complexity: round(liked.reduce((a, e) => a + e.doc.vibe!.complexity, 0) / liked.length, 2),
      }
    : null;

  // Every month of the range up to now (months that haven't happened aren't empty, they're
  // just not yet), at most two years of bars, busiest picked out.
  const counts = new Map<number, number>();
  for (const e of entries) counts.set(monthStart(e.at).getTime(), (counts.get(monthStart(e.at).getTime()) ?? 0) + 1);
  const months: WrappedView["months"] = [];
  const last = Math.min(to.getTime(), Date.now());
  for (let d = monthStart(from); d.getTime() <= last && months.length < 24; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    months.push({ start: d.toISOString(), count: counts.get(d.getTime()) ?? 0 });
  }
  const busiest = months.reduce<WrappedView["busiest"]>((best, m) => (m.count > (best?.count ?? 0) ? m : best), null);

  const first = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  const [timeline, profile] = await Promise.all([getTimeline(uid), getFreshProfile(uid)]);

  return {
    range: { from: from.toISOString(), to: to.toISOString(), label: rangeLabel(from, to) },
    titles: entries.length,
    hours: Math.round(
      entries.reduce((a, e) => a + (e.status === "watched" && e.doc.runtime ? (e.doc.mediaType === "tv" ? e.doc.runtime * (e.doc.episodes ?? 1) : e.doc.runtime) : 0), 0) / 60,
    ),
    films: entries.filter((e) => e.doc.mediaType === "movie").length,
    series: entries.filter((e) => e.doc.mediaType === "tv").length,
    avgRating: rated.length ? round(rated.reduce((a, e) => a + e.rating!, 0) / rated.length) : null,
    topGenres: [...votes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([term, v]) => ({ term, word: genreWord(term), share: Math.round((v / voteTotal) * 100) })),
    favourites: rated
      .filter((e) => e.status !== "dropped")
      .sort((a, b) => b.rating! - a.rating! || b.at.getTime() - a.at.getTime())
      .slice(0, 5)
      .map((e) => ({ ...card(e.key as TitleKey, e.doc), rating: e.rating! })),
    first: first ? { ...card(first.key as TitleKey, first.doc), at: first.at.toISOString() } : null,
    months,
    busiest: busiest && busiest.count > 0 ? busiest : null,
    eras: timeline.eras.filter((e) => new Date(e.start) < end && new Date(e.end) > from).map((e) => ({ name: e.name, start: e.start, end: e.end })),
    vibe,
    feel: vibe ? feelWords(vibe) : [],
    dna: toTasteView(profile).dna,
  };
}
