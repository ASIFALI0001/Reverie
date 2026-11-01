import "server-only";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import pLimit from "p-limit";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { SeriesDecision } from "@/lib/db/models/Insights";
import { ensureTitle } from "@/lib/catalog/ensure";
import { titleKey, type TitleKey } from "@/lib/catalog/types";
import { getSeason, getSeasonIndex, type SeasonIndex } from "@/lib/sources/tmdb";
import { generateSeriesVerdict } from "@/lib/ai/series";
import { getFreshProfile } from "@/lib/reco/taste";
import { addToLibrary, updateLibraryItem } from "@/lib/library/service";
import { badRequest, notFound } from "@/lib/http/errors";
import { fallbackVerdict, ratingTrend, seasonChart, spoilerProblems, type Ep, type Position, type SeasonBar, type Verdict } from "@/lib/series/trend";

/**
 * "Should I keep going?": the ratings ahead of their episode, read against their taste by the
 * model under strict spoiler rules, then checked: a reason that names someone who only turns up
 * later, or talks about events, sends it back once; if it trips again, the plain verdict from the
 * numbers stands. Cached per viewer, series, position, reason and taste version for a week.
 */

export type SeriesVerdictView = {
  verdict: Verdict;
  tryUntil: Position | null;
  confidence: number;
  reasons: string[];
  /** "ai" when the model's reasons passed the spoiler check, "facts" for the plain verdict. */
  source: "ai" | "facts";
  position: Position;
  chart: SeasonBar[];
  trend: { watchedAvg: number | null; nextAvg: number | null };
};

type CacheDoc = { uid: string; key: TitleKey; kind: "series"; position: string; reasonHash: string; profileVersion: number; result: SeriesVerdictView; createdAt: Date };

const WEEK_MS = 7 * 86_400_000;
const MAX_SEASONS = 12;

async function cacheCol() {
  await connectDb();
  return mongoose.connection.db!.collection<CacheDoc>("matchCache");
}

/** The seasons, and where their library says they are (to prefill the picker). */
export async function seriesProgress(uid: string, tvId: number): Promise<{ seasons: SeasonIndex; progress: Position | null; status: string | null }> {
  await connectDb();
  const [seasons, item] = await Promise.all([getSeasonIndex(tvId), LibraryItem.findOne({ uid, key: titleKey("tv", tvId) }, { progress: 1, status: 1 }).lean()]);
  const p = item?.progress;
  return { seasons, progress: p?.season && p?.episode ? { season: p.season, episode: p.episode } : null, status: item?.status ?? null };
}

async function allEpisodes(tvId: number, seasons: SeasonIndex) {
  const limit = pLimit(4);
  const lists = await Promise.all(seasons.slice(0, MAX_SEASONS).map((s) => limit(async () => ({ season: s.season, eps: await getSeason(tvId, s.season).catch(() => []) }))));
  return lists.flatMap((l) => l.eps.map((e) => ({ ...e, season: l.season })));
}

export async function shouldContinue(uid: string, tvId: number, input: { season: number; episode: number; reason?: string | null }): Promise<SeriesVerdictView> {
  const key = titleKey("tv", tvId);
  const doc = await ensureTitle(key, { enrich: false, jikan: false });
  if (!doc) throw notFound("We couldn’t find that series.");
  const seasons = await getSeasonIndex(tvId);
  const current = seasons.find((s) => s.season === input.season);
  if (!current || input.episode < 1 || input.episode > current.episodes) throw badRequest("That season and episode don’t exist for this series.");
  const position = { season: input.season, episode: input.episode };
  const reason = input.reason?.trim().slice(0, 200) || null;
  const reasonHash = createHash("sha1").update(reason?.toLowerCase() ?? "").digest("hex").slice(0, 12);

  // Where they are goes back into their library, if it's there.
  await LibraryItem.updateOne({ uid, key }, { $set: { progress: position } });

  const profile = await getFreshProfile(uid);
  const profileVersion = profile?.version ?? 0;
  const cache = await cacheCol();
  const hit = await cache.findOne({ uid, key, kind: "series", position: `${position.season}x${position.episode}`, reasonHash, profileVersion, createdAt: { $gte: new Date(Date.now() - WEEK_MS) } });
  if (hit) return hit.result;

  const episodes = await allEpisodes(tvId, seasons);
  const eps: Ep[] = episodes.map((e) => ({ season: e.season, episode: e.episode_number, rating: e.vote_average || null, votes: e.vote_count }));
  const trend = ratingTrend(eps, position);
  const chart = seasonChart(eps);
  const at = (s: number, e: number) => s * 1000 + e;
  const seen = episodes.filter((e) => at(e.season, e.episode_number) <= at(position.season, position.episode));
  const later = episodes.filter((e) => at(e.season, e.episode_number) > at(position.season, position.episode));
  const context = {
    known: [doc.title, doc.overview, ...seen.flatMap((e) => [e.name, e.overview])].join("\n"),
    later: later.flatMap((e) => [e.name, e.overview]).join("\n"),
  };

  let result: Omit<SeriesVerdictView, "position" | "chart" | "trend"> | null = null;
  const prompt = {
    title: doc.title,
    genres: doc.genres,
    overview: doc.overview,
    taste: { summary: profile?.tasteSummary ?? null, dna: profile?.tasteDNA ?? [] },
    position,
    bothering: reason,
    trend: { watchedAvg: trend.watchedAvg, nextAvg: trend.nextAvg, restAvg: trend.restAvg, pickup: trend.pickup, episodesAhead: trend.episodesAhead },
    seasonAverages: chart.map((c) => ({ season: c.season, avg: c.avg })),
    later: later.slice(0, 24).map((e) => ({ season: e.season, episode: e.episode_number, rating: e.vote_average || null, overview: e.overview.slice(0, 300) })),
  };
  let avoid: string[] = [];
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      const draft = await generateSeriesVerdict(prompt, avoid);
      const problems = spoilerProblems(draft.reasons, context);
      if (problems.length) {
        console.warn(`[series] spoiler check rejected a draft (${problems.join("; ")})`);
        avoid = problems;
        continue;
      }
      // "Give it till" must point ahead of them, at an episode that exists.
      const until = draft.tryUntil;
      const valid = until && at(until.season, until.episode) > at(position.season, position.episode) && seasons.some((s) => s.season === until.season && until.episode <= s.episodes);
      result = {
        verdict: draft.verdict === "try" && !valid ? "keep" : draft.verdict,
        tryUntil: draft.verdict === "try" && valid ? until : null,
        confidence: Math.round(draft.confidence * 100) / 100,
        reasons: draft.reasons.map((r) => r.trim()),
        source: "ai",
      };
    } catch (err) {
      console.warn("[series] verdict unavailable, using the numbers:", err instanceof Error ? err.message.slice(0, 160) : err);
      break;
    }
  }
  const final: SeriesVerdictView = {
    ...(result ?? { ...fallbackVerdict(trend), source: "facts" as const }),
    position,
    chart,
    trend: { watchedAvg: trend.watchedAvg, nextAvg: trend.nextAvg },
  };
  if (final.source === "ai") {
    await cache.updateOne(
      { uid, key, kind: "series", position: `${position.season}x${position.episode}`, reasonHash, profileVersion },
      { $set: { result: final, createdAt: new Date() } },
      { upsert: true },
    );
  }
  return final;
}

/**
 * What they decided: kept watching or stopped. Saved, and it becomes a real taste signal:
 * the series goes into their library as Watching or Dropped, at the episode they're on.
 */
export async function saveSeriesDecision(uid: string, tvId: number, input: { decision: "kept" | "stopped"; season: number; episode: number; verdict?: Verdict | null }) {
  await connectDb();
  const key = titleKey("tv", tvId);
  await SeriesDecision.create({ uid, key, decision: input.decision, season: input.season, episode: input.episode, verdict: input.verdict ?? null });
  const status = input.decision === "kept" ? "watching" : "dropped";
  const exists = await LibraryItem.exists({ uid, key });
  if (exists) await updateLibraryItem(uid, "tv", tvId, { status });
  else await addToLibrary(uid, "tv", tvId, { status });
  await LibraryItem.updateOne({ uid, key }, { $set: { progress: { season: input.season, episode: input.episode } } });
  return { decision: input.decision, status };
}
