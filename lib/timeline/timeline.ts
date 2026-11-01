import "server-only";
import { connectDb } from "@/lib/db/connect";
import { TasteSnapshot, TasteTimeline } from "@/lib/db/models/Insights";
import { LibraryItem } from "@/lib/db/models/Library";
import { titlesCol } from "@/lib/db/titles";
import { generateEraNames, type EraPrompt } from "@/lib/ai/eras";
import { keepAlive } from "@/lib/reco/taste";
import { titleHref } from "@/lib/catalog/links";
import { parseTitleKey, type TitleKey } from "@/lib/catalog/types";
import { SHOWN_TO_FRIENDS } from "@/lib/social/visibility";
import { rebuildSnapshots } from "@/lib/timeline/build";
import { detectEras, fallbackEraLine, fallbackEraName, fnv, genreSeries, type Era, type MonthInput } from "@/lib/timeline/eras";
import { highlights, topRated, type StatItem, type StatTitle } from "@/lib/timeline/stats";
import type { TermValue } from "@/lib/timeline/snapshots";
import type { RadarPoint } from "@/lib/taste/types";

/**
 * The taste timeline: monthly snapshots brought up to date, split into eras, each era named.
 * Names are kept per era (by its first month) for as long as its two leading genres hold, so
 * logging another title doesn't rename your past; only new or changed eras go to the model.
 */

export type EraView = {
  start: string;
  end: string;
  months: number;
  count: number;
  hours: number;
  avgRating: number | null;
  genres: TermValue[];
  radar: RadarPoint[];
  vibe: { pace: number; tone: number; complexity: number } | null;
  topTitles: { key: TitleKey; title: string; posterPath: string | null; rating: number | null; href: string | null }[];
  shift: number | null;
  name: string;
  line: string;
};

export type TimelineView = {
  status: "empty" | "ok";
  eras: EraView[];
  series: { genres: string[]; months: { start: string; count: number; shares: number[] | null }[] };
  stats: {
    titles: number;
    hours: number;
    avgRating: number | null;
    months: number;
    since: string | null;
    topGenre: { name: string; titles: number } | null;
    highestRated: { title: string; rating: number; href: string | null } | null;
    director: { name: string; titles: number } | null;
    binge: { title: string; episodes: number; hours: number | null; href: string | null } | null;
  };
  /** "ai" when every era has a model-written name; the plain names otherwise. */
  source: "ai" | "facts";
  /** Names are still being written in the background: ask again shortly. */
  pending: boolean;
};

type NameEntry = { start: string; genresKey: string; name: string; line: string; source: "ai" | "facts" };

const NAME_BUDGET_MS = 8000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const genresKey = (e: Era) =>
  e.genres
    .slice(0, 2)
    .map((g) => g.term)
    .sort()
    .join("+");
const fmtMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const band = (v: number, low: string, mid: string, high: string) => (v <= 0.38 ? low : v >= 0.65 ? high : mid);

/** Vibe scales: pace 0 slow-burn … 1 fast; tone 0 light … 1 dark; complexity 0 easy … 1 demanding. */
function feelOf(vibe: Era["vibe"]) {
  if (!vibe) return null;
  return [band(vibe.pace, "slow-burn", "measured", "fast"), band(vibe.tone, "light", "bittersweet", "dark"), band(vibe.complexity, "easy", "layered", "demanding")].join(", ");
}

function promptOf(e: Era): EraPrompt {
  return {
    from: fmtMonth(e.start),
    to: fmtMonth(new Date(e.end.getTime() - 1)),
    months: e.months,
    titles: e.count,
    genres: e.genres.slice(0, 4).map((g) => `${g.term} ${Math.round(g.value * 100)}%`),
    feel: feelOf(e.vibe),
    favourites: e.topTitles
      .filter((t) => (t.rating ?? 0) >= 7)
      .slice(0, 3)
      .map((t) => t.title),
    turn: e.shift == null ? null : e.shift > 0.5 ? "sharp" : "gentle",
  };
}

async function nameEras(uid: string, eras: Era[]): Promise<{ names: NameEntry[]; pending: boolean }> {
  const doc = await TasteTimeline.findOne({ uid }, { eras: 1 }).lean();
  const byStart = new Map(((doc?.eras ?? []) as NameEntry[]).map((c) => [c.start, c]));
  const current: NameEntry[] = eras.map((e) => {
    const kept = byStart.get(monthKey(e.start));
    if (kept && kept.genresKey === genresKey(e)) return kept;
    return { start: monthKey(e.start), genresKey: genresKey(e), name: fallbackEraName(e), line: fallbackEraLine(e), source: "facts" };
  });
  const missing = current.flatMap((c, i) => (c.source === "ai" ? [] : [i]));
  if (!missing.length) return { names: current, pending: false };

  const task = (async () => {
    const taken = current.filter((_, i) => !missing.includes(i)).map((c) => c.name);
    const written = await generateEraNames(
      missing.map((i) => promptOf(eras[i]!)),
      taken,
    );
    const next = current.map((c, i) => {
      const k = missing.indexOf(i);
      return k >= 0 ? { ...c, name: written[k]!.name, line: written[k]!.line, source: "ai" as const } : c;
    });
    await TasteTimeline.updateOne(
      { uid },
      { $set: { eras: next, hash: fnv(next.map((n) => `${n.start}:${n.genresKey}`).join("|")), builtAt: new Date() } },
      { upsert: true },
    );
    return next;
  })();
  const settled = await Promise.race([
    task.then(
      (names) => ({ names }),
      (err) => {
        console.warn("[timeline] era names unavailable, using plain ones:", err instanceof Error ? err.message.slice(0, 160) : err);
        return { names: current };
      },
    ),
    sleep(NAME_BUDGET_MS).then(() => null),
  ]);
  if (settled) return { names: settled.names, pending: false };
  // Slow model: show the plain names now; the written ones land for the next look.
  keepAlive(task);
  return { names: current, pending: true };
}

const EMPTY: TimelineView = {
  status: "empty",
  eras: [],
  series: { genres: [], months: [] },
  stats: { titles: 0, hours: 0, avgRating: null, months: 0, since: null, topGenre: null, highestRated: null, director: null, binge: null },
  source: "facts",
  pending: false,
};

const STAT_FIELDS = { title: 1, mediaType: 1, genres: 1, directors: 1, episodes: 1, runtime: 1, posterPath: 1 } as const;
const hrefOf = (key: string, title: string) => {
  const k = parseTitleKey(key);
  return k ? titleHref(k.mediaType, k.tmdbId, title) : null;
};

/** The library as the numbers see it. `shareable`: only what friends may see (for anything that leaves the app). */
async function statsInput(uid: string, shareable = false): Promise<{ items: StatItem[]; titles: Map<string, StatTitle> }> {
  await connectDb();
  const rows = await LibraryItem.find({ uid, ...(shareable ? SHOWN_TO_FRIENDS : {}) }, { key: 1, status: 1, rating: 1, watchedAt: 1, addedAt: 1 }).lean();
  const docs = rows.length ? await (await titlesCol()).find({ _id: { $in: rows.map((r) => r.key as TitleKey) } }, { projection: STAT_FIELDS }).toArray() : [];
  return {
    items: rows.map((r) => ({ key: r.key, status: r.status, rating: r.rating ?? null, watchedAt: r.watchedAt ?? null, addedAt: r.addedAt })),
    titles: new Map(
      docs.map((d) => [
        d._id,
        {
          title: d.title,
          mediaType: d.mediaType,
          genres: d.genres ?? [],
          directors: (d.directors ?? []).map((p) => ({ id: p.id, name: p.name })),
          episodes: d.episodes ?? null,
          runtime: d.runtime ?? null,
          posterPath: d.posterPath ?? null,
        },
      ]),
    ),
  };
}

/** The three titles a share card shows: your highest rated, never one hidden from friends. */
export async function shareTopTitles(uid: string) {
  const { items, titles } = await statsInput(uid, true);
  return topRated(items, titles, 3);
}

export async function getTimeline(uid: string): Promise<TimelineView> {
  await rebuildSnapshots(uid);
  await connectDb();
  const [snaps, input] = await Promise.all([TasteSnapshot.find({ uid }).sort({ periodStart: 1 }).lean(), statsInput(uid)]);
  if (!snaps.length) return EMPTY;
  const hl = highlights(input.items, input.titles);
  const months: MonthInput[] = snaps.map((s) => ({
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    count: s.count,
    hours: s.hours ?? 0,
    avgRating: s.avgRating ?? null,
    genreShare: (s.genreShare ?? []) as TermValue[],
    genreAffinity: (s.genreAffinity ?? []) as TermValue[],
    vibe: s.vibe?.pace != null ? { pace: s.vibe.pace, tone: s.vibe.tone ?? 0.5, complexity: s.vibe.complexity ?? 0.5 } : null,
    topTitles: (s.topTitles ?? []).map((t) => ({ key: t.key as TitleKey, title: t.title ?? "", posterPath: t.posterPath ?? null, rating: t.rating ?? null })),
    hash: s.hash,
  }));
  const eras = detectEras(months);
  const { names, pending } = await nameEras(uid, eras);

  const titles = months.reduce((a, m) => a + m.count, 0);
  const rated = months.filter((m) => m.avgRating != null);
  const ratedWeight = rated.reduce((a, m) => a + m.count, 0);
  const series = genreSeries(months, 5);
  return {
    status: "ok",
    eras: eras.map((e, i) => ({
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      months: e.months,
      count: e.count,
      hours: e.hours,
      avgRating: e.avgRating,
      genres: e.genres,
      radar: e.radar,
      vibe: e.vibe,
      topTitles: e.topTitles.map((t) => ({ ...t, href: hrefOf(t.key, t.title) })),
      shift: e.shift,
      name: names[i]!.name,
      line: names[i]!.line,
    })),
    series: { genres: series.genres, months: series.months.map((m) => ({ start: m.start.toISOString(), count: m.count, shares: m.shares })) },
    stats: {
      titles,
      hours: Math.round(months.reduce((a, m) => a + m.hours, 0)),
      avgRating: ratedWeight ? Math.round((rated.reduce((a, m) => a + m.avgRating! * m.count, 0) / ratedWeight) * 10) / 10 : null,
      months: months.length,
      since: months[0]!.periodStart.toISOString(),
      topGenre: hl.topGenre,
      highestRated: hl.highestRated ? { title: hl.highestRated.title, rating: hl.highestRated.rating, href: hrefOf(hl.highestRated.key, hl.highestRated.title) } : null,
      director: hl.director,
      binge: hl.binge ? { title: hl.binge.title, episodes: hl.binge.episodes, hours: hl.binge.hours, href: hrefOf(hl.binge.key, hl.binge.title) } : null,
    },
    source: names.every((n) => n.source === "ai") ? "ai" : "facts",
    pending,
  };
}
