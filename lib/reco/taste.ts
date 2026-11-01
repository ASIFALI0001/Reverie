import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem, WatchlistItem } from "@/lib/db/models/Library";
import { WhyNotFeedback } from "@/lib/db/models/Insights";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import { tasteCol, type TasteProfileDoc } from "@/lib/db/taste";
import { INTERACTIVE_EMBED_MS, embedQuery } from "@/lib/ai/embed";
import { generateTasteSummary, type SummaryInput, type SummaryTitle } from "@/lib/ai/taste-summary";
import { describeReactions } from "@/lib/library/reactions";
import { computeAffinities, eraPreference, fallbackDna, radarFrom, vibePreference, type Affinities } from "@/lib/reco/affinity";
import { getCatalogSample } from "@/lib/reco/catalog-sample";
import { tasteVectorFrom } from "@/lib/reco/taste-vector";
import { FEATURE_PROJECTION, toFeatures } from "@/lib/reco/title-features";
import { dot, percentileTable } from "@/lib/reco/vector";
import { mergeSignals, type Signal } from "@/lib/reco/weights";
import { answerStatement } from "@/lib/taste/statement";
import type { TasteView } from "@/lib/taste/types";
import type { TitleKey } from "@/lib/catalog/types";

const LEASE_MS = 60_000;
/** Regenerate the Gemini summary every ~5 new signals (brief §5.2). */
const SUMMARY_EVERY = 5;
const DEBOUNCE_MS = 2500;
/** A dirty profile older than this is rebuilt on read (its background rebuild must have been lost). */
const STALE_DIRTY_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

/** Keep background work alive after the response; outside a request (scripts) it simply runs. */
export function keepAlive(task: Promise<unknown>) {
  const guarded = task.catch((err) => console.error("[taste] background task failed", err));
  try {
    after(guarded);
  } catch {
    // Not inside a request scope.
  }
}

/** Debounced background rebuild: only the last of a burst of changes actually rebuilds. */
export function scheduleTasteRebuild(uid: string) {
  keepAlive(sleep(DEBOUNCE_MS).then(() => rebuildIfDirty(uid, { quietMs: DEBOUNCE_MS - 300 })));
}

export async function rebuildIfDirty(uid: string, { quietMs = 0 } = {}) {
  const col = await tasteCol();
  const doc = await col.findOne({ uid }, { projection: { dirty: 1, dirtyAt: 1 } });
  if (!doc?.dirty) return null;
  // A newer change queued its own rebuild; let that one run.
  if (quietMs && doc.dirtyAt && Date.now() - doc.dirtyAt.getTime() < quietMs) return null;
  return buildTasteProfile(uid);
}

/** The profile, rebuilt first when it has never been built or a rebuild went missing. */
export async function getFreshProfile(uid: string): Promise<TasteProfileDoc | null> {
  const col = await tasteCol();
  const doc = await col.findOne({ uid });
  const lost = doc?.dirty && (!doc.dirtyAt || Date.now() - doc.dirtyAt.getTime() > STALE_DIRTY_MS);
  if (doc && doc.builtAt && !lost) return doc;
  return (await buildTasteProfile(uid)) ?? doc;
}

function blankProfile(): Omit<TasteProfileDoc, "uid"> {
  const now = new Date();
  return {
    answers: null,
    onboarding: null,
    signals: [],
    signalCount: 0,
    tasteVector: null,
    vectorSignals: 0,
    answerVector: null,
    answerHash: null,
    vectorPercentiles: null,
    genreAffinity: [],
    keywordAffinity: [],
    peopleAffinity: [],
    collectionAffinity: [],
    languageAffinity: [],
    vibePreference: null,
    era: { answer: null, meanYear: null },
    radar: radarFrom([]),
    tasteSummary: null,
    tasteDNA: [],
    summarySource: null,
    summarySignalCount: 0,
    summaryReviewHash: null,
    version: 0,
    dirty: false,
    dirtyAt: null,
    leaseUntil: null,
    builtAt: null,
    updatedAt: now,
  };
}

/** Upsert the profile shell, so onboarding and dirty-marking always have a document to write to. */
export async function ensureProfileDoc(uid: string) {
  const col = await tasteCol();
  await col.updateOne({ uid }, { $setOnInsert: blankProfile() }, { upsert: true });
}

type BuildOptions = {
  /** Regenerate the summary even if fewer than SUMMARY_EVERY signals changed (onboarding does this). */
  forceSummary?: boolean;
  /** Give Gemini this long before falling back; a slow answer still lands in the profile afterwards. */
  summaryBudgetMs?: number;
};

/**
 * Rebuild one viewer's taste profile from the library, watchlist and onboarding.
 * One rebuild per user at a time (a short lease); if another is running, the
 * current document is returned and that rebuild's result lands shortly.
 */
export async function buildTasteProfile(uid: string, opts: BuildOptions = {}): Promise<TasteProfileDoc | null> {
  await ensureProfileDoc(uid);
  const col = await tasteCol();
  const startedAt = new Date();
  const prev = await col.findOneAndUpdate(
    { uid, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: startedAt } }] },
    { $set: { leaseUntil: new Date(startedAt.getTime() + LEASE_MS) } },
    { returnDocument: "before" },
  );
  if (!prev) return col.findOne({ uid });

  try {
    const fields = await compute(uid, prev, opts, startedAt);
    // Clear `dirty` only if nothing changed while we were building; otherwise the next rebuild picks it up.
    const clean = await col.updateOne(
      { uid, $or: [{ dirtyAt: null }, { dirtyAt: { $lte: startedAt } }] },
      { $set: { ...fields, dirty: false, leaseUntil: null }, $inc: { version: 1 } },
    );
    if (!clean.matchedCount) await col.updateOne({ uid }, { $set: { ...fields, leaseUntil: null }, $inc: { version: 1 } });
    // A new taste means new Taste Twins (imported lazily: lib/twins builds on this module).
    keepAlive(import("@/lib/twins/compute").then((m) => m.afterProfileBuilt(uid)));
    return col.findOne({ uid });
  } catch (err) {
    await col.updateOne({ uid }, { $set: { leaseUntil: null } });
    throw err;
  }
}

type Built = Omit<TasteProfileDoc, "uid" | "answers" | "onboarding" | "version" | "dirty" | "dirtyAt" | "leaseUntil">;

async function compute(uid: string, prev: TasteProfileDoc, opts: BuildOptions, now: Date): Promise<Built> {
  await connectDb();
  const [library, watchlist, whyNot] = await Promise.all([
    LibraryItem.find({ uid }, { key: 1, status: 1, rating: 1, addedAt: 1, updatedAt: 1, worked: 1, didnt: 1, note: 1, hiddenFromFriends: 1 }).lean(),
    WatchlistItem.find({ uid }, { key: 1, addedAt: 1, hiddenFromFriends: 1 }).lean(),
    WhyNotFeedback.find({ uid }, { key: 1, helpful: 1, createdAt: 1 }).lean(),
  ]);
  // Their own take on titles (what worked, what didn't, their words), as prompt lines.
  const reactions = new Map(
    library.flatMap((l) => {
      const line = describeReactions(l, 200);
      return line ? [[l.key as TitleKey, line] as const] : [];
    }),
  );
  const reviewHash = reactions.size ? sha1([...reactions].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}|${v}`).join("\n")) : null;
  const signals = mergeSignals(
    {
      // When the opinion was recorded matters more than when the film was seen.
      library: library.map((l) => ({
        key: l.key as TitleKey,
        status: l.status,
        rating: l.rating ?? null,
        at: (l as { updatedAt?: Date }).updatedAt ?? l.addedAt,
      })),
      watchlist: watchlist.map((w) => ({ key: w.key as TitleKey, at: w.addedAt })),
      swipes: prev.onboarding?.swipes ?? [],
      favourites: prev.onboarding?.favourites ?? [],
      whyNot: whyNot.map((f) => ({ key: f.key as TitleKey, helpful: f.helpful, at: f.createdAt })),
    },
    now,
  );

  const titles = await titlesCol();
  const docs = await titles
    .find({ _id: { $in: signals.map((s) => s.key) } }, { projection: { ...FEATURE_PROJECTION, embedding: 1 } })
    .toArray();
  const byKey = new Map(docs.map((d) => [d._id, d]));
  const features = new Map(docs.map((d) => [d._id, toFeatures(d)]));
  const known = signals.filter((s) => byKey.has(s.key));

  // Answer vector: re-embed only when the answers changed.
  const answers = prev.answers;
  let answerVector = answers ? prev.answerVector : null;
  let answerHash = answers ? prev.answerHash : null;
  if (answers) {
    const statement = answerStatement(answers);
    const hash = sha1(statement);
    if (statement && (hash !== answerHash || !answerVector)) {
      try {
        // Someone may be watching the "building your taste" screen: a busy quota mustn't hold it up.
        // Without the vector the profile still builds from the answers' genres and moods, and the
        // next rebuild tries again (the hash only changes once an embedding lands).
        answerVector = await embedQuery(statement, { budgetMs: INTERACTIVE_EMBED_MS });
        answerHash = hash;
      } catch (err) {
        console.warn("[taste] answer embedding unavailable:", err instanceof Error ? err.message.slice(0, 160) : err);
      }
    }
  }

  const withVectors = known.flatMap((s) => {
    const v = byKey.get(s.key)?.embedding;
    return v?.length ? [{ key: s.key, vector: v, weight: s.weight }] : [];
  });
  const tasteVector = tasteVectorFrom(withVectors, answerVector);
  let vectorPercentiles: number[] | null = null;
  if (tasteVector) {
    const sample = await getCatalogSample();
    if (sample.length >= 50) vectorPercentiles = percentileTable(sample.map((v) => dot(tasteVector, v)));
  }

  const aff = computeAffinities(known, features, answers);
  const vibe = vibePreference(known, features, answers);
  const era = eraPreference(known, features, answers);

  // What friends and twins compare against: the same maths without anything hidden from friends.
  const hidden = new Set<string>([...library, ...watchlist].filter((i) => i.hiddenFromFriends).map((i) => i.key));
  const socialVector = hidden.size ? tasteVectorFrom(withVectors.filter((w) => !hidden.has(w.key)), answerVector) : tasteVector;
  const socialGenreAffinity = hidden.size ? computeAffinities(known.filter((s) => !hidden.has(s.key)), features, answers).genre : aff.genre;

  // Summary + DNA: Gemini every ~5 signals or whenever their reviews change, with a deterministic fallback.
  const signalCount = known.length;
  let summary = {
    tasteSummary: prev.tasteSummary,
    tasteDNA: prev.tasteDNA,
    summarySource: prev.summarySource,
    summarySignalCount: prev.summarySignalCount,
    summaryReviewHash: prev.summaryReviewHash ?? null,
  };
  const hasEvidence = signalCount > 0 || answers != null;
  const due =
    opts.forceSummary ||
    !prev.tasteDNA.length ||
    prev.summarySource !== "gemini" ||
    Math.abs(signalCount - prev.summarySignalCount) >= SUMMARY_EVERY ||
    reviewHash !== (prev.summaryReviewHash ?? null);
  if (hasEvidence && due) {
    const input = summaryInput(known, byKey, aff, vibe, answers, reactions);
    const written = { summarySource: "gemini" as const, summarySignalCount: signalCount, summaryReviewHash: reviewHash };
    const task = generateTasteSummary(input);
    const outcome = await settleWithin(task, opts.summaryBudgetMs);
    if (outcome.status === "done") {
      summary = { tasteSummary: outcome.value.summary, tasteDNA: outcome.value.dna, ...written };
    } else {
      if (outcome.status === "failed") {
        console.warn("[taste] summary fell back:", outcome.error instanceof Error ? outcome.error.message.slice(0, 160) : outcome.error);
        retrySummaryLater(uid, input, written);
      }
      summary = {
        tasteSummary: null,
        tasteDNA: fallbackDna(aff, vibe, answers),
        summarySource: "fallback",
        summarySignalCount: prev.summarySignalCount,
        summaryReviewHash: prev.summaryReviewHash ?? null,
      };
      if (outcome.status === "pending") {
        // The model is just slow: let it finish and land on this profile.
        keepAlive(
          task.then(async (r) => {
            const col = await tasteCol();
            await col.updateOne({ uid }, { $set: { tasteSummary: r.summary, tasteDNA: r.dna, ...written } });
          }),
        );
      }
    }
  } else if (!hasEvidence) {
    summary = { tasteSummary: null, tasteDNA: [], summarySource: null, summarySignalCount: 0, summaryReviewHash: null };
  }

  return {
    signals: known,
    signalCount,
    tasteVector,
    vectorSignals: withVectors.length,
    answerVector,
    answerHash,
    vectorPercentiles,
    genreAffinity: aff.genre,
    socialVector,
    socialGenreAffinity,
    keywordAffinity: aff.keyword,
    peopleAffinity: aff.people,
    collectionAffinity: aff.collection,
    languageAffinity: aff.language,
    vibePreference: vibe,
    era,
    radar: radarFrom(aff.genre),
    ...summary,
    builtAt: now,
    updatedAt: new Date(),
  };
}

type Written = { summarySource: "gemini"; summarySignalCount: number; summaryReviewHash: string | null };

/** Every model was busy: try once more shortly, so the Gemini DNA replaces the fallback. */
function retrySummaryLater(uid: string, input: SummaryInput, written: Written) {
  keepAlive(
    sleep(20_000).then(async () => {
      const r = await generateTasteSummary(input);
      const col = await tasteCol();
      await col.updateOne({ uid, summarySource: "fallback" }, { $set: { tasteSummary: r.summary, tasteDNA: r.dna, ...written } });
    }),
  );
}

type Settled<T> = { status: "done"; value: T } | { status: "failed"; error: unknown } | { status: "pending" };

async function settleWithin<T>(task: Promise<T>, budgetMs?: number): Promise<Settled<T>> {
  const settled = task.then(
    (value): Settled<T> => ({ status: "done", value }),
    (error): Settled<T> => ({ status: "failed", error }),
  );
  if (!budgetMs) return settled;
  return Promise.race([settled, sleep(budgetMs).then((): Settled<T> => ({ status: "pending" }))]);
}

function summaryInput(
  signals: Signal[],
  docs: Map<TitleKey, Pick<TitleDoc, "title" | "year" | "genres" | "vibe">>,
  aff: Affinities,
  vibe: TasteProfileDoc["vibePreference"],
  answers: TasteProfileDoc["answers"],
  reactions: Map<TitleKey, string>,
) {
  const toTitle = (s: Signal): SummaryTitle | null => {
    const d = docs.get(s.key);
    if (!d) return null;
    const note = s.source === "favourite" ? "an all-time favourite" : s.type === "dropped" ? "dropped it" : undefined;
    return { title: d.title, year: d.year, genres: d.genres.slice(0, 3), vibe: d.vibe?.summary ?? null, note, reactions: reactions.get(s.key) ?? null };
  };
  // Titles they've said something about come first: their words carry the most information.
  const pick = (xs: Signal[], n: number) =>
    [...xs.filter((s) => reactions.has(s.key)), ...xs.filter((s) => !reactions.has(s.key))]
      .slice(0, n)
      .map(toTitle)
      .filter((t): t is SummaryTitle => t != null);
  const byWeight = [...signals].sort((a, b) => b.weight - a.weight);
  return {
    answers,
    loved: pick(byWeight.filter((s) => s.weight >= 0.75), 12),
    liked: pick(byWeight.filter((s) => s.weight >= 0.3 && s.weight < 0.75), 8),
    disliked: pick([...signals].sort((a, b) => a.weight - b.weight).filter((s) => s.weight < 0), 8),
    likedGenres: aff.genre.filter((g) => g.value > 0.25).slice(0, 5).map((g) => g.term),
    dislikedGenres: aff.genre.filter((g) => g.value < -0.25).slice(0, 3).map((g) => g.term),
    themes: aff.keyword.filter((k) => k.value > 0.3).slice(0, 10).map((k) => k.term),
    vibe,
  };
}

export function toTasteView(doc: TasteProfileDoc | null): TasteView {
  const ready = !!doc?.builtAt && (doc.signalCount > 0 || doc.answers != null);
  if (!doc || !ready) {
    return { status: "none", version: doc?.version ?? 0, dna: [], summary: null, radar: radarFrom([]), vibe: null, signalCount: 0, topGenres: [], updatedAt: null };
  }
  return {
    status: "ready",
    version: doc.version,
    dna: doc.tasteDNA,
    summary: doc.tasteSummary,
    radar: doc.radar,
    vibe: doc.vibePreference,
    signalCount: doc.signalCount,
    topGenres: doc.genreAffinity
      .filter((g) => g.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((g) => ({ genre: g.term, affinity: g.value })),
    updatedAt: doc.builtAt?.toISOString() ?? null,
  };
}
