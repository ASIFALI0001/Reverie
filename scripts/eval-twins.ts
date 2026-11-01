/**
 * Does the Taste Twins nudge help? A synthetic population on real catalog titles: people drawn
 * from six tastes, each rating ~80 popular titles (mostly ones they're inclined to like, as people
 * do). For each person, hide 20% of their ratings, rebuild their profile from the rest with the
 * real code, find their twins with the real similarity and rules among everyone else, and predict
 * the hidden ratings with the quick match, with and without the twin nudge (lib/twins/math.ts).
 *
 *   npm run eval:twins                 report in .qa/eval/twins-<date>.md
 *
 * Caveat, reported with the numbers: the population is synthetic and taste is defined by genre and
 * feel, so the feature score is partly circular; the comparison that matters is with vs without.
 */
import "./_env";
import { mkdirSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import { getCatalogSample } from "@/lib/reco/catalog-sample";
import { computeAffinities, eraPreference, vibePreference, type Affinity, type TitleFeatures } from "@/lib/reco/affinity";
import { featureProfile, featureScore, type FeatureProfile } from "@/lib/reco/features";
import { blendMatch } from "@/lib/reco/match-math";
import { meanSd, ndcgAt, pearson, spearman } from "@/lib/reco/metrics";
import { tasteVectorFrom } from "@/lib/reco/taste-vector";
import { FEATURE_PROJECTION, toFeatures } from "@/lib/reco/title-features";
import { dot, percentileRank, percentileTable } from "@/lib/reco/vector";
import { mergeSignals } from "@/lib/reco/weights";
import { tasteSimilarity } from "@/lib/social/similarity";
import { rng } from "@/lib/taste/deck";
import { applyOutsideNudges, TWIN_RULES, type TwinRating } from "@/lib/twins/math";
import type { TitleKey } from "@/lib/catalog/types";

const NOW = new Date();
const PER_TASTE = 12;
const RATINGS = 80;
const SPLITS = 3;

type Doc = TitleDoc & { embedding: number[] };
type Rated = { key: TitleKey; rating: number };
type Person = { id: number; taste: number; rated: Rated[] };

const has = (d: Doc, ...g: string[]) => (d.genres.some((x) => g.includes(x)) ? 1 : 0);
const vibe = (d: Doc, k: "pace" | "tone" | "complexity") => ((d.vibe?.[k] ?? 0.5) - 0.5) * 2;

/** Six tastes, each a lean over genres and feel. */
const TASTES: { name: string; lean: (d: Doc) => number }[] = [
  { name: "cerebral sci-fi & crime", lean: (d) => 1.0 * has(d, "Science Fiction") + 0.8 * has(d, "Thriller", "Crime", "Mystery") - 1.0 * has(d, "Romance") - 1.0 * has(d, "Family", "Animation") + 0.8 * vibe(d, "complexity") },
  { name: "romance & comedy", lean: (d) => 1.2 * has(d, "Romance") + 0.8 * has(d, "Comedy") - 1.0 * has(d, "Horror") - 0.8 * has(d, "War") - 0.6 * vibe(d, "tone") },
  { name: "horror & dread", lean: (d) => 1.3 * has(d, "Horror") + 0.6 * has(d, "Thriller", "Mystery") - 1.0 * has(d, "Family", "Animation") - 0.5 * has(d, "Romance") + 0.6 * vibe(d, "tone") },
  { name: "animation & family", lean: (d) => 1.2 * has(d, "Animation") + 1.0 * has(d, "Family") + 0.5 * has(d, "Fantasy") - 1.2 * has(d, "Horror") - 0.6 * has(d, "Crime") },
  { name: "prestige drama & history", lean: (d) => 1.0 * has(d, "Drama") + 1.0 * has(d, "History") + 0.6 * has(d, "War") - 0.5 * has(d, "Action") + 0.6 * vibe(d, "complexity") },
  { name: "action & adventure", lean: (d) => 1.2 * has(d, "Action") + 1.0 * has(d, "Adventure") + 0.4 * has(d, "Science Fiction") - 0.6 * has(d, "Drama") + 0.6 * vibe(d, "pace") },
];

function gauss(random: () => number) {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}
const zscore = (xs: number[]) => {
  const { mean, sd } = meanSd(xs);
  return xs.map((x) => (x - mean) / (sd || 1));
};

/** People of one taste differ: their own weight on each part of the lean, and their own noise. */
function population(docs: Doc[]): Person[] {
  const out: Person[] = [];
  TASTES.forEach((taste, ti) => {
    for (let p = 0; p < PER_TASTE; p++) {
      const random = rng(1000 * (ti + 1) + p);
      const own = docs.map(() => gauss(random) * 0.35);
      const latent = zscore(docs.map((d, i) => taste.lean(d) + own[i]!));
      // What they watched: popular titles, and more of what they're inclined to like.
      const weight = docs.map((d, i) => Math.sqrt(d.voteCount ?? 1) * Math.exp(0.7 * latent[i]!));
      const picked = new Set<number>();
      const total = weight.reduce((a, b) => a + b, 0);
      while (picked.size < RATINGS) {
        let r = random() * total;
        for (let i = 0; i < docs.length; i++) if ((r -= weight[i]!) <= 0) {
          picked.add(i);
          break;
        }
      }
      out.push({
        id: out.length,
        taste: ti,
        rated: [...picked].map((i) => ({ key: docs[i]!._id, rating: Math.min(10, Math.max(1, Math.round(5.5 + 2.2 * latent[i]! + gauss(random))) ) })),
      });
    }
  });
  return out;
}

type Model = { fp: FeatureProfile; vector: number[] | null; pct: number[] | null; genres: Affinity[] };

function buildModel(rated: Rated[], byKey: Map<TitleKey, Doc>, sample: Float32Array[]): Model {
  const signals = mergeSignals({ library: rated.map((r) => ({ key: r.key, status: "watched" as const, rating: r.rating, at: NOW })), watchlist: [], swipes: [], favourites: [] }, NOW);
  const features = new Map<TitleKey, TitleFeatures>(rated.map((r) => [r.key, toFeatures(byKey.get(r.key)!)]));
  const aff = computeAffinities(signals, features, null);
  const vector = tasteVectorFrom(signals.map((s) => ({ vector: byKey.get(s.key)!.embedding, weight: s.weight })), null);
  return {
    fp: featureProfile({
      genreAffinity: aff.genre,
      keywordAffinity: aff.keyword,
      peopleAffinity: aff.people,
      collectionAffinity: aff.collection,
      languageAffinity: aff.language,
      vibePreference: vibePreference(signals, features, null),
      era: eraPreference(signals, features, null),
      answers: null,
    }),
    vector,
    pct: vector ? percentileTable(sample.map((v) => dot(vector, v))) : null,
    genres: aff.genre,
  };
}

const fmt = (x: { mean: number; sd: number }) => `${x.mean.toFixed(3)} ± ${x.sd.toFixed(3)}`;

async function main() {
  const titles = await titlesCol();
  const docs = (await titles
    .find({ "embedding.0": { $exists: true }, vibe: { $ne: null }, voteCount: { $gte: 800 } }, { projection: { ...FEATURE_PROJECTION, embedding: 1, voteCount: 1 } })
    .sort({ voteCount: -1 })
    .limit(400)
    .toArray()) as Doc[];
  const byKey = new Map(docs.map((d) => [d._id, d]));
  const sample = await getCatalogSample();
  const mean = new Float32Array(sample[0]!.length);
  for (const v of sample) for (let i = 0; i < mean.length; i++) mean[i]! += v[i]! / sample.length;
  const people = population(docs);
  console.log(`${docs.length} titles, ${people.length} people (${TASTES.length} tastes × ${PER_TASTE}), ${RATINGS} ratings each, ${SPLITS} splits.`);

  // Everyone's full profile (what others see of them).
  const full = people.map((p) => buildModel(p.rated, byKey, sample));
  const ratingsOf = people.map((p) => new Map(p.rated.map((r) => [r.key, r.rating])));

  const metrics = { base: { s: [] as number[], p: [] as number[], n: [] as number[] }, twins: { s: [] as number[], p: [] as number[], n: [] as number[] } };
  let covered = 0;
  let tested = 0;
  const twinCounts: number[] = [];
  const twinScores: number[] = [];
  let sameTaste = 0;
  let allTwins = 0;
  const moved: number[] = [];

  for (const person of people) {
    for (let split = 0; split < SPLITS; split++) {
      const random = rng(7000 + person.id * 10 + split);
      const order = person.rated.map((r) => ({ r, k: random() })).sort((a, b) => a.k - b.k).map((x) => x.r);
      const cut = Math.round(order.length * 0.8);
      const train = order.slice(0, cut);
      const test = order.slice(cut);
      const me = buildModel(train, byKey, sample);
      const mine = new Map(train.map((r) => [r.key, r.rating]));

      // Twins among everyone else, with the real similarity and rules.
      const twins = people
        .filter((o) => o.id !== person.id)
        .flatMap((o) => {
          const shared: [number, number][] = [];
          for (const [k, r] of ratingsOf[o.id]!) if (mine.has(k)) shared.push([mine.get(k)!, r]);
          const sim = tasteSimilarity({ vector: me.vector, genres: me.genres }, { vector: full[o.id]!.vector, genres: full[o.id]!.genres }, { mean, sharedRatings: shared });
          return sim && sim.score >= TWIN_RULES.minScore ? [{ o, score: sim.score }] : [];
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, TWIN_RULES.max);
      twinCounts.push(twins.length);
      for (const t of twins) {
        twinScores.push(t.score);
        allTwins++;
        if (t.o.taste === person.taste) sameTaste++;
      }

      const truth: number[] = [];
      const base: number[] = [];
      const nudged: number[] = [];
      for (const t of test) {
        const d = byKey.get(t.key)!;
        const vector = me.vector && me.pct ? percentileRank(dot(me.vector, d.embedding), me.pct) : null;
        const b = blendMatch({ vector, features: featureScore(toFeatures(d), me.fp).score });
        const rates: TwinRating[] = twins.flatMap((tw) => {
          const r = ratingsOf[tw.o.id]!.get(t.key);
          return r != null ? [{ score: tw.score, rating: r }] : [];
        });
        const n = applyOutsideNudges(b, [], rates);
        if (n.twinWeight) {
          covered++;
          moved.push(Math.abs(n.score - b));
        }
        tested++;
        truth.push(t.rating);
        base.push(b);
        nudged.push(n.score);
      }
      metrics.base.s.push(spearman(base, truth));
      metrics.base.p.push(pearson(base, truth));
      metrics.base.n.push(ndcgAt(10, base, truth));
      metrics.twins.s.push(spearman(nudged, truth));
      metrics.twins.p.push(pearson(nudged, truth));
      metrics.twins.n.push(ndcgAt(10, nudged, truth));
    }
  }

  const delta = metrics.twins.s.map((x, i) => x - metrics.base.s[i]!);
  const better = delta.filter((d) => d > 0.0005).length;
  const worse = delta.filter((d) => d < -0.0005).length;
  const lines = [
    `# Taste Twins evaluation — ${NOW.toISOString().slice(0, 10)}`,
    "",
    `Synthetic population on ${docs.length} popular catalog titles: ${TASTES.length} tastes × ${PER_TASTE} people, ${RATINGS} ratings each (mostly titles they lean toward, popularity-weighted). ${SPLITS} random 80/20 splits per person; metrics on the hidden 20%.`,
    "",
    "| Prediction | Spearman ρ | Pearson r | NDCG@10 |",
    "|---|---|---|---|",
    `| Quick match | ${fmt(meanSd(metrics.base.s))} | ${fmt(meanSd(metrics.base.p))} | ${fmt(meanSd(metrics.base.n))} |`,
    `| Quick match + twin nudge | ${fmt(meanSd(metrics.twins.s))} | ${fmt(meanSd(metrics.twins.p))} | ${fmt(meanSd(metrics.twins.n))} |`,
    "",
    `- Spearman change per person-split: ${fmt(meanSd(delta))}; better in ${better}, worse in ${worse}, unchanged in ${delta.length - better - worse} of ${delta.length}.`,
    `- Twins found: ${fmt(meanSd(twinCounts))} per person (max ${TWIN_RULES.max}, from a ${TWIN_RULES.minScore}% taste match), mean match ${meanSd(twinScores).mean.toFixed(1)}%; ${allTwins ? ((sameTaste / allTwins) * 100).toFixed(1) : "0"}% share the person's own taste.`,
    `- The nudge applied to ${((covered / Math.max(1, tested)) * 100).toFixed(1)}% of hidden titles (two or more twins had rated them), moving the score by ${fmt(meanSd(moved.length ? moved : [0]))} points where it did.`,
    "",
    "Caveat: synthetic people with genre-and-feel tastes, so the feature score is partly circular; the with/without comparison is the point.",
  ];
  console.log(`\n${lines.slice(4).join("\n")}`);
  mkdirSync(".qa/eval", { recursive: true });
  const file = `.qa/eval/twins-${NOW.toISOString().slice(0, 10)}.md`;
  writeFileSync(file, `${lines.join("\n")}\n`);
  console.log(`\nReport: ${file}`);
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
