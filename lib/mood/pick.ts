import "server-only";
import mongoose from "mongoose";
import pLimit from "p-limit";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { User } from "@/lib/db/models/User";
import { MoodSession } from "@/lib/db/models/Insights";
import { CARD_PROJECTION, titlesCol, type TitleDoc } from "@/lib/db/titles";
import { toCard, cardMeta, type TitleCard } from "@/lib/catalog/cards";
import { CATEGORY_LABEL } from "@/lib/catalog/category";
import type { MediaType, TitleKey } from "@/lib/catalog/types";
import { getWatchProviders, type ProviderEntry } from "@/lib/sources/tmdb";
import { INTERACTIVE_EMBED_MS, embedQuery } from "@/lib/ai/embed";
import { moodTargetFromText, rerankForMood } from "@/lib/ai/mood";
import { getFreshProfile } from "@/lib/reco/taste";
import { getQuickScores } from "@/lib/reco/match-engine";
import { vectorSearch, type VectorFilter } from "@/lib/reco/vector-search";
import { badRequest, notFound } from "@/lib/http/errors";
import { env } from "@/lib/env";
import {
  COMPANY_OPTIONS,
  TIME_OPTIONS,
  moodFit,
  moodScore,
  pickVaried,
  presetById,
  timeConstraints,
  withCompany,
  type Company,
  type MoodTarget,
  type MoodTime,
} from "@/lib/mood/target";

/**
 * Mood Search: three picks for this moment and this taste.
 *   1. The mood becomes a target: a preset's hand-made mapping, or the model reading free text.
 *   2. Candidates: titles near the mood (an embedding of its description) and near their taste,
 *      within the time's format and length; titles they've already seen are out (unless it's a
 *      comfort rewatch, which draws on what they rated highly).
 *   3. Score: 0.5 · mood fit + 0.5 · their match. The top 15 go to the model, which picks the six
 *      best with a line each; three are shown, kept varied, and the rest wait as swaps.
 */

// Cards plus their trailers. CARD_PROJECTION is an exclusion list, so videos come back by dropping
// it from that list (MongoDB won't mix `videos: 1` into an exclusion).
const PICK_PROJECTION = Object.fromEntries(Object.entries(CARD_PROJECTION).filter(([field]) => field !== "videos"));

export type WhereToWatch = { name: string; logoPath: string | null };
export type MoodPick = {
  key: string;
  card: TitleCard;
  match: number | null;
  reason: string;
  /** "1h 52m" or "3 seasons". */
  length: string | null;
  streaming: WhereToWatch[];
  trailerKey: string | null;
};
export type MoodResult = {
  sessionId: string;
  label: string;
  picks: MoodPick[];
  /** "Only on my services" was asked for but no services are set yet. */
  servicesMissing: boolean;
  region: string;
};

type Candidate = TitleDoc & { match: number | null; fit: number; score: number };
type Plain = { key: string; score: number | null; reason: string };

/** What keeps picks varied: the title's franchise and collection. */
const tagOf = (d: Pick<TitleDoc, "franchises" | "collection">) => ({ franchise: d.franchises?.[0] ?? null, collection: d.collection?.id ?? null });

const SHORTLIST = 15;
const SHOWN = 3;
const KEEP = 6;

export async function runMood(
  uid: string,
  input: { preset?: string | null; text?: string | null; time: MoodTime; company?: Company | null; onlyMyServices?: boolean },
): Promise<MoodResult> {
  const preset = presetById(input.preset);
  const text = input.text?.trim() || null;
  if (!preset && !text) throw badRequest("Pick a mood, or describe one.");
  await connectDb();
  const [user, profile] = await Promise.all([User.findById(uid, { region: 1, services: 1 }).lean(), getFreshProfile(uid)]);
  const region = user?.region ?? env.defaultRegion();

  // 1. The target.
  let base: MoodTarget;
  if (preset) base = { ...preset.target, formats: [], runtimeMax: null };
  else {
    try {
      base = await moodTargetFromText(text!);
    } catch (err) {
      console.warn("[mood] free-text mapping unavailable, reading it plainly:", err instanceof Error ? err.message.slice(0, 120) : err);
      base = { targetVibe: { pace: 0.5, tone: 0.45, complexity: 0.45 }, moods: [], themesWanted: [], themesAvoid: [], formats: [], runtimeMax: null, allowRewatch: false, genres: [], query: text! };
    }
  }
  const target = withCompany(base, input.company ?? null);
  const time = timeConstraints(input.time);

  // 2. Candidates.
  const seen = await LibraryItem.find({ uid }, { key: 1, rating: 1, status: 1 }).lean();
  const seenKeys = new Set(seen.map((s) => s.key as TitleKey));
  let keys: TitleKey[];
  if (target.allowRewatch) {
    keys = seen.filter((s) => (s.rating ?? 0) >= 8 && s.status === "watched").map((s) => s.key as TitleKey);
  } else {
    const filter: VectorFilter = { mediaType: time.mediaType };
    if (target.formats.length) filter.category = { $in: target.formats };
    const [moodVector, near] = await Promise.all([
      embedQuery(target.query, { budgetMs: INTERACTIVE_EMBED_MS }).catch(() => null),
      Promise.resolve(profile?.tasteVector ?? null),
    ]);
    const found = new Set<TitleKey>();
    for (const vector of [moodVector, near]) {
      if (!vector) continue;
      for (const h of await vectorSearch(vector, { limit: 70, filter, exclude: [...seenKeys] })) found.add(h.key);
    }
    if (found.size < 20) {
      // Little or nothing from the vectors (no embedding today, or a thin catalog corner): genres stand in.
      const titles = await titlesCol();
      const rows = await titles
        .find(
          { mediaType: time.mediaType, _id: { $nin: [...seenKeys] }, ...(target.genres.length ? { genres: { $in: target.genres } } : {}), voteCount: { $gte: 200 } },
          { projection: { _id: 1 }, sort: { voteCount: -1 }, limit: 80 },
        )
        .toArray();
      for (const r of rows) found.add(r._id);
    }
    keys = [...found];
  }

  const titles = await titlesCol();
  const docs = (await titles.find({ _id: { $in: keys } }, { projection: PICK_PROJECTION }).toArray()) as TitleDoc[];
  const fits = docs.filter((d) => {
    if (d.mediaType !== time.mediaType) return false;
    if (!d.runtime) return input.time === "binge" || input.time === "long";
    if (time.runtimeMin && d.runtime < time.runtimeMin) return false;
    if (time.runtimeMax && d.runtime > time.runtimeMax) return false;
    if (target.runtimeMax && d.runtime > target.runtimeMax) return false;
    return true;
  });

  // 3. Score: mood and taste, equally.
  const scores = await getQuickScores(uid, fits.map((d) => d._id).slice(0, 80)).catch(() => ({}) as Record<string, number>);
  let ranked: Candidate[] = fits
    .map((d) => {
      const fit = moodFit({ vibe: d.vibe ? { pace: d.vibe.pace, tone: d.vibe.tone, complexity: d.vibe.complexity } : null, moods: d.vibe?.mood ?? [], themes: d.vibe?.themes ?? [], genres: d.genres }, target);
      const match = scores[d._id] ?? null;
      return Object.assign(d, { fit, match, score: moodScore(fit, match) });
    })
    .sort((a, b) => b.score - a.score);

  // Only what's on their services, when asked (and when they've said which services they have).
  const services = new Set((user?.services ?? []) as number[]);
  const servicesMissing = Boolean(input.onlyMyServices) && services.size === 0;
  const streamingOf = new Map<string, ProviderEntry[]>();
  if (input.onlyMyServices && services.size) {
    const limit = pLimit(6);
    const checked = await Promise.all(
      ranked.slice(0, 40).map((c) =>
        limit(async () => {
          const s = await streaming(c.mediaType, c.tmdbId, region);
          streamingOf.set(c._id, s);
          return s.some((p) => services.has(p.provider_id)) ? c : null;
        }),
      ),
    );
    ranked = checked.filter((c): c is Candidate => c != null);
  }

  const shortlist = pickVaried(
    ranked.map((c) => ({ c, ...tagOf(c) })),
    SHORTLIST,
  ).map((x) => x.c);
  if (!shortlist.length) {
    const session = await MoodSession.create({ uid, mood: { preset: preset?.id ?? null, text }, time: input.time, company: input.company ?? null, onlyMyServices: Boolean(input.onlyMyServices), target, picks: [] });
    return { sessionId: String(session._id), label: preset?.label ?? text!, picks: [], servicesMissing, region };
  }

  // The model picks six with a line each; without it, the scores decide and the line is plain.
  const moodLabel = preset ? `${preset.label} (${preset.line})` : text!;
  let ordered: { c: Candidate; reason: string }[] = [];
  try {
    const res = await rerankForMood({
      mood: moodLabel,
      time: TIME_OPTIONS.find((t) => t.id === input.time)!.label,
      company: COMPANY_OPTIONS.find((c) => c.id === input.company)?.label ?? null,
      candidates: shortlist.map((c) => ({
        id: c._id,
        title: c.title,
        year: c.year,
        kind: CATEGORY_LABEL[c.category],
        runtime: cardMeta(c) ?? null,
        genres: c.genres.slice(0, 3),
        feel: c.vibe?.summary ?? null,
        match: c.match,
      })),
    });
    const byId = new Map(shortlist.map((c) => [c._id as string, c]));
    ordered = res.picks.flatMap((p) => (byId.has(p.id) ? [{ c: byId.get(p.id)!, reason: p.reason.trim() }] : []));
  } catch (err) {
    console.warn("[mood] re-rank unavailable, using the scores:", err instanceof Error ? err.message.slice(0, 120) : err);
  }
  const chosen = new Set(ordered.map((o) => o.c._id));
  for (const c of shortlist) if (ordered.length < KEEP && !chosen.has(c._id)) ordered.push({ c, reason: plainReason(c, preset?.label ?? null) });
  const varied = pickVaried(ordered.map((o) => ({ ...o, ...tagOf(o.c) })), KEEP);
  const shown = varied.slice(0, SHOWN);
  const spares = varied.slice(SHOWN);

  const session = await MoodSession.create({
    uid,
    mood: { preset: preset?.id ?? null, text },
    time: input.time,
    company: input.company ?? null,
    onlyMyServices: Boolean(input.onlyMyServices),
    target,
    picks: shown.map((o) => ({ key: o.c._id, score: o.c.score, reason: o.reason })),
    spares: spares.map((o) => ({ key: o.c._id, score: o.c.score, reason: o.reason })),
  });
  const picks = await Promise.all(shown.map((o) => toPick(o.c, o.reason, region, streamingOf, services)));
  return { sessionId: String(session._id), label: preset?.label ?? text!, picks, servicesMissing, region };
}

/** "Not this": the next spare that keeps the picks varied, or null when there's nothing left. */
export async function swapMoodPick(uid: string, sessionId: string, key: string): Promise<MoodPick | null> {
  const session = await ownSession(uid, sessionId);
  const plain = (rows: { key: string; score?: number | null; reason?: string | null }[] | null | undefined): Plain[] =>
    (rows ?? []).map((r) => ({ key: r.key, score: r.score ?? null, reason: r.reason ?? "" }));
  const spares = plain(session.spares);
  const keep = plain(session.picks).filter((p) => p.key !== key);
  const titles = await titlesCol();
  const docs = (await titles.find({ _id: { $in: [...keep, ...spares].map((p) => p.key as TitleKey) } }, { projection: PICK_PROJECTION }).toArray()) as TitleDoc[];
  const byKey = new Map(docs.map((d) => [d._id as string, d]));
  const tag = (k: string) => (byKey.has(k) ? tagOf(byKey.get(k)!) : { franchise: null, collection: null });
  const [next] = pickVaried(
    spares.filter((s) => byKey.has(s.key)).map((s) => ({ ...s, ...tag(s.key) })),
    1,
    keep.map((p) => ({ ...p, ...tag(p.key) })),
  );
  await MoodSession.updateOne(
    { _id: session._id },
    {
      $set: { picks: next ? [...keep, { key: next.key, score: next.score, reason: next.reason }] : keep, spares: spares.filter((s) => s.key !== next?.key) },
      $addToSet: { swapped: key },
    },
  );
  if (!next) return null;
  const user = await User.findById(uid, { region: 1, services: 1 }).lean();
  const scores = await getQuickScores(uid, [next.key as TitleKey]).catch(() => ({}) as Record<string, number>);
  const doc = Object.assign(byKey.get(next.key)!, { match: scores[next.key] ?? null, fit: 0, score: next.score ?? 0 });
  return toPick(doc, next.reason, user?.region ?? env.defaultRegion(), new Map(), new Set((user?.services ?? []) as number[]));
}

/** Which pick they went with (opened, saved or played): what Mood Search learns from. */
export async function chooseMoodPick(uid: string, sessionId: string, key: string) {
  const session = await ownSession(uid, sessionId);
  if (!session.picks.some((p) => p.key === key)) throw badRequest("That wasn’t one of the picks.");
  await MoodSession.updateOne({ _id: session._id }, { $set: { chosenKey: key } });
  return { chosen: key };
}

async function ownSession(uid: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw notFound("That mood session isn’t there any more.");
  await connectDb();
  const s = await MoodSession.findById(id).lean();
  if (!s || s.uid !== uid) throw notFound("That mood session isn’t there any more.");
  return s;
}

async function streaming(mediaType: MediaType, tmdbId: number, region: string): Promise<ProviderEntry[]> {
  try {
    const r = (await getWatchProviders(mediaType, tmdbId)).results?.[region];
    const all = [...(r?.flatrate ?? []), ...(r?.free ?? []), ...(r?.ads ?? [])].sort((a, b) => a.display_priority - b.display_priority);
    return all.filter((p, i) => all.findIndex((q) => q.provider_id === p.provider_id) === i);
  } catch {
    return [];
  }
}

async function toPick(c: TitleDoc & { match: number | null }, reason: string, region: string, known: Map<string, ProviderEntry[]>, mine: Set<number>): Promise<MoodPick> {
  // Their own services first: "where to watch" answers the question they asked.
  const providers = [...(known.get(c._id) ?? (await streaming(c.mediaType, c.tmdbId, region)))].sort((a, b) => Number(mine.has(b.provider_id)) - Number(mine.has(a.provider_id)));
  const trailer = (c.videos ?? []).find((v) => v.type === "Trailer" && v.official) ?? (c.videos ?? [])[0] ?? null;
  return {
    key: c._id,
    card: toCard(c),
    match: c.match,
    reason,
    length: cardMeta(c) ?? null,
    streaming: providers.slice(0, 3).map((p) => ({ name: p.provider_name, logoPath: p.logo_path ?? null })),
    trailerKey: trailer?.key ?? null,
  };
}

/** Without the model: a plain, honest line from the mood and the match. */
function plainReason(c: Candidate, label: string | null): string {
  const feel = c.vibe?.mood?.slice(0, 2).join(" and ");
  const lead = feel ? `${feel[0]!.toUpperCase()}${feel.slice(1)}` : label ? `Right for ${label.toLowerCase()}` : "A good fit tonight";
  return c.match != null ? `${lead}, and a ${c.match}% match for you.` : `${lead}.`;
}
