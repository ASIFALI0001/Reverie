import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { User } from "@/lib/db/models/User";
import { WhyNotFeedback } from "@/lib/db/models/Insights";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import type { TasteProfileDoc } from "@/lib/db/taste";
import { ensureTitle } from "@/lib/catalog/ensure";
import { titleHref } from "@/lib/catalog/links";
import { notFound } from "@/lib/http/errors";
import { generateWhyNot } from "@/lib/ai/why-not";
import { getFreshProfile } from "@/lib/reco/taste";
import { markTasteDirty } from "@/lib/reco/taste-dirty";
import { hasTaste, judgeTarget, nearestSeen } from "@/lib/reco/match-engine";
import { fallbackWhyNot, median, mismatches, sanitizeWhyNot, type EvidenceTitle, type WhyNotDraft } from "@/lib/reco/why-not";
import type { TitleKey } from "@/lib/catalog/types";

export type EvidenceCard = { key: string; title: string; posterPath: string | null; href: string };
export type WhyNotView = {
  status: "ok";
  negatives: { reason: string; evidence: EvidenceCard[] }[];
  positive: string | null;
  /** "ai" when the model wrote it (cached for this taste version), "facts" when built from the evidence alone. */
  source: "ai" | "facts";
  profileVersion: number;
  /** Their "Was this right?" answer, if they gave one. */
  feedback: boolean | null;
};

type CacheDoc = { uid: string; key: TitleKey; profileVersion: number; kind: "whyNot"; result: Omit<WhyNotView, "feedback">; createdAt: Date };

async function cacheCol() {
  await connectDb();
  return mongoose.connection.db!.collection<CacheDoc>("matchCache");
}

const inflight = new Map<string, Promise<Omit<WhyNotView, "feedback">>>();

/**
 * Why a title might not be for this viewer: the closest titles they didn't enjoy, plus feature
 * mismatches, explained by the model under strict rules (or plainly from the facts when it's
 * unavailable). Cached with the match, per taste-profile version. `quick` skips the model
 * (list popovers): a cached explanation if there is one, else the facts.
 */
export async function getWhyNot(uid: string, key: TitleKey, { quick = false } = {}): Promise<WhyNotView | { status: "no-profile" }> {
  const profile = await getFreshProfile(uid);
  if (!hasTaste(profile)) return { status: "no-profile" };
  const [hit, feedback] = await Promise.all([
    (await cacheCol()).findOne({ uid, key, profileVersion: profile.version, kind: "whyNot" }),
    WhyNotFeedback.findOne({ uid, key }, { helpful: 1 }).lean(),
  ]);
  const answer = feedback ? Boolean(feedback.helpful) : null;
  if (hit) return { ...hit.result, feedback: answer };

  const id = `${uid}:${key}:${profile.version}:${quick ? "q" : "f"}`;
  let task = inflight.get(id);
  if (!task) {
    task = compute(uid, key, profile, quick).finally(() => inflight.delete(id));
    inflight.set(id, task);
  }
  return { ...(await task), feedback: answer };
}

async function compute(uid: string, key: TitleKey, profile: TasteProfileDoc, quick: boolean): Promise<Omit<WhyNotView, "feedback">> {
  const doc = await ensureTitle(key, { enrich: !quick, jikan: false });
  if (!doc) throw notFound("We couldn’t find that title.");
  const titles = await titlesCol();
  const embedding = (await titles.findOne({ _id: key }, { projection: { embedding: 1 } }))?.embedding ?? null;

  // The twelve closest titles they've seen; the ones they didn't enjoy are the evidence. Titles they
  // only answered "Was this right?" about were never watched, so they're never cited.
  const [nearest, history, user] = await Promise.all([nearestSeen(profile, doc, embedding, 14), historyStats(uid, profile), User.findById(uid, { languages: 1 }).lean()]);
  const near = nearest.filter((n) => n.signal.source !== "feedback").slice(0, 12);
  const evidence: EvidenceTitle[] = near.map((n) => ({
    key: n.doc._id,
    title: n.doc.title,
    feeling: n.neighbour.feeling,
    liked: n.neighbour.liked,
    dropped: n.signal.type === "dropped",
    rating: n.signal.rating ?? null,
  }));
  const facts = mismatches({
    target: {
      mediaType: doc.mediaType,
      runtime: doc.runtime,
      genres: doc.genres,
      year: doc.year,
      language: doc.originalLanguage ?? null,
      vibe: doc.vibe ? { pace: doc.vibe.pace, tone: doc.vibe.tone, complexity: doc.vibe.complexity } : null,
    },
    vibe: profile.vibePreference,
    genreAffinity: profile.genreAffinity,
    usualRuntime: history.usualRuntime,
    meanYear: profile.era?.meanYear ?? null,
    avoidsSubtitles: profile.answers?.subtitles === false,
    languages: [...(profile.answers?.languages ?? []), ...(user?.languages ?? [])],
  }).slice(0, 4);

  const disliked = near.filter((n) => !n.neighbour.liked).slice(0, 4);
  const liked = near.filter((n) => n.neighbour.liked).slice(0, 3);
  const allowed = new Set(disliked.map((n) => n.doc._id as string));

  let draft: WhyNotDraft | null = null;
  if (!quick && (disliked.length || facts.length)) {
    try {
      draft = sanitizeWhyNot(
        await generateWhyNot({
          target: judgeTarget(doc),
          disliked: disliked.map((n) => toPrompt(n)),
          liked: liked.map((n) => toPrompt(n)),
          facts: facts.map((f) => f.fact),
        }),
        allowed,
      );
      if (!draft.negatives.length) draft = null;
    } catch (err) {
      console.warn("[why-not] model unavailable, using the facts:", err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  const source = draft ? "ai" : "facts";
  const final = draft ?? fallbackWhyNot(facts, evidence);

  const cards = new Map(near.map((n) => [n.doc._id as string, n.doc]));
  const result: Omit<WhyNotView, "feedback"> = {
    status: "ok",
    negatives: final.negatives.map((n) => ({
      reason: n.reason,
      evidence: n.evidence.flatMap((k) => {
        const d = cards.get(k);
        return d ? [{ key: d._id, title: d.title, posterPath: d.posterPath, href: titleHref(d.mediaType, d.tmdbId, d.title) }] : [];
      }),
    })),
    positive: final.positive,
    source,
    profileVersion: profile.version,
  };
  // Only the model's explanation is worth keeping; the facts are recomputed (and the model retried) next time.
  if (source === "ai") {
    await (await cacheCol()).updateOne(
      { uid, key, profileVersion: profile.version, kind: "whyNot" },
      { $set: { result, createdAt: new Date() } },
      { upsert: true },
    );
  }
  return result;
}

function toPrompt(n: Awaited<ReturnType<typeof nearestSeen>>[number]) {
  return {
    id: n.doc._id as string,
    title: n.doc.title,
    year: n.doc.year,
    genres: n.doc.genres.slice(0, 4),
    feeling: n.neighbour.feeling,
    reactions: n.neighbour.reactions,
    vibe: n.neighbour.vibe,
  };
}

/** The length of the films they finish and like: the yardstick for "longer than usual". */
async function historyStats(uid: string, profile: TasteProfileDoc) {
  const liked = profile.signals.filter((s) => s.weight > 0 && s.type !== "watchlisted" && s.key.startsWith("movie:")).map((s) => s.key);
  if (liked.length < 3) return { usualRuntime: null };
  const docs = (await (await titlesCol()).find({ _id: { $in: liked.slice(0, 120) } }, { projection: { runtime: 1 } }).toArray()) as Pick<TitleDoc, "_id" | "runtime">[];
  return { usualRuntime: median(docs.flatMap((d) => (d.runtime ? [d.runtime] : []))) };
}

/** "Was this right?": saved per title, and fed back into the taste profile as a weak signal. */
export async function saveWhyNotFeedback(uid: string, key: TitleKey, helpful: boolean) {
  await connectDb();
  const exists = await LibraryItem.exists({ uid, key });
  await WhyNotFeedback.updateOne({ uid, key }, { $set: { helpful, createdAt: new Date() }, $setOnInsert: { uid, key } }, { upsert: true });
  // A title already in their library has stronger signals; only an unseen one's profile changes.
  if (!exists) await markTasteDirty(uid);
  return { helpful };
}
