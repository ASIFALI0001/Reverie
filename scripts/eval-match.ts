/**
 * Offline evaluation of the match engine (brief §5.3.7): hide 20% of a viewer's
 * ratings, rebuild their profile from the other 80% with the real scoring code,
 * predict the hidden ones, and report how well the predictions track the truth.
 *
 *   npm run eval:match                     three synthetic viewers, 5 splits each
 *   npm run eval:match -- --uid=<firebase uid>   a real viewer (needs 20+ ratings)
 *   npm run eval:match -- --llm=16         also run Gemini's judgement on 16 hidden titles
 *
 * Synthetic viewers are deterministic. Two are defined by genres and vibe, so the
 * feature score is partly circular for them; the "exemplar" viewer is defined only
 * by closeness to example films in embedding space, which keeps the vector score honest.
 */
import "./_env";
import { mkdirSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import { LibraryItem } from "@/lib/db/models/Library";
import { getCatalogSample } from "@/lib/reco/catalog-sample";
import { computeAffinities, eraPreference, vibePreference, type TitleFeatures } from "@/lib/reco/affinity";
import { featureProfile, featureScore, type FeatureProfile } from "@/lib/reco/features";
import { blendMatch, QUICK_WEIGHTS } from "@/lib/reco/match-math";
import { meanSd, ndcgAt, pearson, spearman } from "@/lib/reco/metrics";
import { tasteVectorFrom } from "@/lib/reco/taste-vector";
import { FEATURE_PROJECTION, toFeatures } from "@/lib/reco/title-features";
import { cosine, dot, normalize, percentileRank, percentileTable, weightedMean } from "@/lib/reco/vector";
import { mergeSignals, type Signal } from "@/lib/reco/weights";
import { rng } from "@/lib/taste/deck";
import type { TitleKey } from "@/lib/catalog/types";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const SPLITS = Number(arg("splits") ?? 5);
const LLM_N = Number(arg("llm") ?? 0);
// Gemini calls cost quota, so the LLM check runs on one viewer: by default the non-circular exemplar one.
const LLM_PERSONA = arg("llm-persona") ?? "B";
const NOW = new Date();

type Doc = TitleDoc & { embedding: number[] };
type Rated = { key: TitleKey; rating: number };
type Persona = { name: string; note: string; rated: Rated[] };

const clampRating = (x: number) => Math.min(10, Math.max(1, Math.round(x)));

/** Box–Muller from our seeded PRNG. */
function gauss(random: () => number) {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function zscore(xs: number[]) {
  const { mean, sd } = meanSd(xs);
  return xs.map((x) => (x - mean) / (sd || 1));
}

function sample<T>(xs: T[], n: number, random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}

const has = (d: Doc, ...genres: string[]) => d.genres.some((g) => genres.includes(g));

function syntheticPersonas(docs: Doc[]): Persona[] {
  const byKey = new Map(docs.map((d) => [d._id, d]));
  const out: Persona[] = [];

  // A · cerebral sci-fi and crime; not romance, family or musicals.
  {
    const random = rng(101);
    const picked = sample(docs, 150, random);
    const latent = zscore(
      picked.map(
        (d) =>
          1.0 * +has(d, "Science Fiction", "Sci-Fi & Fantasy") +
          0.8 * +has(d, "Thriller", "Crime", "Mystery") -
          1.2 * +has(d, "Romance") -
          1.0 * +has(d, "Family", "Kids", "Music") -
          0.3 * +has(d, "Comedy") +
          1.2 * ((d.vibe?.complexity ?? 0.5) - 0.5) * 2 +
          0.8 * ((d.vibe?.tone ?? 0.5) - 0.5) * 2,
      ),
    );
    out.push({
      name: "A · cerebral sci-fi & crime",
      note: "defined by genres + vibe (feature score partly circular)",
      rated: picked.map((d, i) => ({ key: d._id, rating: clampRating(5.5 + 2.2 * latent[i]! + gauss(random)) })),
    });
  }

  // B · exemplar-defined: likes what's near Interstellar/Inception/Matrix/Arrival, dislikes what's near The Notebook/Twilight/La La Land.
  {
    const random = rng(202);
    const love = (["movie:157336", "movie:27205", "movie:603", "movie:329865", "movie:335984"] as TitleKey[]).flatMap((k) => byKey.get(k)?.embedding ?? []);
    const hate = (["movie:11036", "movie:8966", "movie:313369", "movie:11631", "movie:216015"] as TitleKey[]).flatMap((k) => byKey.get(k)?.embedding ?? []);
    const chunk = (flat: number[]) => {
      const dim = docs[0]!.embedding.length;
      return Array.from({ length: flat.length / dim }, (_, i) => flat.slice(i * dim, (i + 1) * dim));
    };
    const loveC = normalize(weightedMean(chunk(love), chunk(love).map(() => 1)));
    const hateC = normalize(weightedMean(chunk(hate), chunk(hate).map(() => 1)));
    const exemplars = new Set(["movie:157336", "movie:27205", "movie:603", "movie:329865", "movie:335984", "movie:11036", "movie:8966", "movie:313369", "movie:11631", "movie:216015"]);
    const picked = sample(docs.filter((d) => !exemplars.has(d._id)), 150, random);
    const latent = zscore(picked.map((d) => cosine(d.embedding, loveC) - cosine(d.embedding, hateC)));
    out.push({
      name: "B · exemplar taste",
      note: `defined only by embedding closeness to ${chunk(love).length} loved / ${chunk(hate).length} disliked films`,
      rated: picked.map((d, i) => ({ key: d._id, rating: clampRating(5.5 + 2.2 * latent[i]! + gauss(random)) })),
    });
  }

  // C · anime and animation, light in tone; not horror or crime.
  {
    const random = rng(303);
    const animated = docs.filter((d) => d.category === "anime" || d.category === "cartoon");
    const rest = sample(docs.filter((d) => d.category !== "anime" && d.category !== "cartoon"), Math.max(0, 150 - Math.min(animated.length, 80)), random);
    const picked = [...sample(animated, 80, random), ...rest];
    const latent = zscore(
      picked.map(
        (d) =>
          1.2 * +(d.category === "anime") +
          0.8 * +(d.category === "cartoon") +
          0.8 * (0.5 - (d.vibe?.tone ?? 0.5)) * 2 +
          0.5 * +has(d, "Adventure", "Fantasy", "Action & Adventure") -
          0.8 * +has(d, "Horror", "Crime"),
      ),
    );
    out.push({
      name: "C · animation, light tone",
      note: "defined by format + tone (feature score partly circular)",
      rated: picked.map((d, i) => ({ key: d._id, rating: clampRating(5.5 + 2.2 * latent[i]! + gauss(random)) })),
    });
  }
  return out;
}

type Model = { fp: FeatureProfile; tasteVector: number[] | null; pct: number[] | null };

/** The profile the app would build from these ratings alone (no onboarding answers). */
function buildModel(train: Rated[], byKey: Map<TitleKey, Doc>, sampleVecs: Float32Array[], random: () => number): Model {
  const signals: Signal[] = mergeSignals(
    {
      library: train.map((t) => ({ key: t.key, status: "watched" as const, rating: t.rating, at: new Date(NOW.getTime() - random() * 400 * 86_400_000) })),
      watchlist: [],
      swipes: [],
      favourites: [],
    },
    NOW,
  );
  const features = new Map<TitleKey, TitleFeatures>(train.map((t) => [t.key, toFeatures(byKey.get(t.key)!)]));
  const aff = computeAffinities(signals, features, null);
  const tasteVector = tasteVectorFrom(
    signals.map((s) => ({ vector: byKey.get(s.key)!.embedding, weight: s.weight })),
    null,
  );
  const pct = tasteVector ? percentileTable(sampleVecs.map((v) => dot(tasteVector, v))) : null;
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
    tasteVector,
    pct,
  };
}

type Pred = { truth: number; vector: number | null; features: number; tmdb: number; random: number };

function evaluate(preds: Pred[], score: (p: Pred) => number) {
  const truth = preds.map((p) => p.truth);
  const s = preds.map(score);
  return { spearman: spearman(s, truth), pearson: pearson(s, truth), ndcg: ndcgAt(10, s, truth) };
}

const fmt = (x: { mean: number; sd: number }) => `${x.mean.toFixed(3)} ± ${x.sd.toFixed(3)}`;

async function main() {
  const titles = await titlesCol();
  const docs = (await titles
    .find({ "embedding.0": { $exists: true }, vibe: { $ne: null } }, { projection: { ...FEATURE_PROJECTION, embedding: 1, voteAverage: 1, category: 1 } })
    .toArray()) as Doc[];
  const byKey = new Map(docs.map((d) => [d._id, d]));
  const sampleVecs = await getCatalogSample();
  console.log(`Catalog: ${docs.length} titles with embeddings + vibe; percentile sample ${sampleVecs.length}.`);

  let personas: Persona[];
  const uid = arg("uid");
  if (uid) {
    const items = await LibraryItem.find({ uid, rating: { $ne: null } }, { key: 1, rating: 1 }).lean();
    const rated = items.filter((i) => byKey.has(i.key as TitleKey)).map((i) => ({ key: i.key as TitleKey, rating: i.rating! }));
    if (rated.length < 20) throw new Error(`That viewer has ${rated.length} rated titles with embeddings; 20+ are needed.`);
    personas = [{ name: `viewer ${uid.slice(0, 6)}…`, note: "real ratings", rated }];
  } else {
    personas = syntheticPersonas(docs);
  }

  const weights = Array.from({ length: 11 }, (_, i) => i / 10);
  const lines: string[] = [`# Match evaluation — ${NOW.toISOString().slice(0, 10)}`, ""];
  lines.push(`Catalog: ${docs.length} titles with embeddings. ${SPLITS} random 80/20 splits per viewer. Metrics on the hidden 20%.`, "");
  const grid = new Map<number, number[]>(weights.map((w) => [w, []]));

  for (const persona of personas) {
    const rows: Record<string, { spearman: number[]; pearson: number[]; ndcg: number[] }> = {};
    const add = (name: string, r: ReturnType<typeof evaluate>) => {
      rows[name] ??= { spearman: [], pearson: [], ndcg: [] };
      rows[name]!.spearman.push(r.spearman);
      rows[name]!.pearson.push(r.pearson);
      rows[name]!.ndcg.push(r.ndcg);
    };
    let lastSplit: { model: Model; test: Rated[]; train: Rated[] } | null = null;

    for (let split = 0; split < SPLITS; split++) {
      const random = rng(1000 + split);
      const shuffled = sample(persona.rated, persona.rated.length, random);
      const cut = Math.round(shuffled.length * 0.8);
      const train = shuffled.slice(0, cut);
      const test = shuffled.slice(cut);
      const model = buildModel(train, byKey, sampleVecs, random);
      const preds: Pred[] = test.map((t) => {
        const d = byKey.get(t.key)!;
        return {
          truth: t.rating,
          vector: model.tasteVector && model.pct ? percentileRank(dot(model.tasteVector, d.embedding), model.pct) : null,
          features: featureScore(toFeatures(d), model.fp).score,
          tmdb: d.voteAverage ?? 0,
          random: random(),
        };
      });
      add("Quick match (shipped weights)", evaluate(preds, (p) => blendMatch({ vector: p.vector, features: p.features })));
      add("Vector only", evaluate(preds, (p) => p.vector ?? 0.5));
      add("Features only", evaluate(preds, (p) => p.features));
      add("Baseline: TMDB rating", evaluate(preds, (p) => p.tmdb));
      add("Baseline: random", evaluate(preds, (p) => p.random));
      for (const w of weights) grid.get(w)!.push(evaluate(preds, (p) => w * (p.vector ?? p.features) + (1 - w) * p.features).spearman);
      lastSplit = { model, test, train };
    }

    console.log(`\n${persona.name} (${persona.rated.length} ratings; ${persona.note})`);
    lines.push(`## ${persona.name}`, "", `${persona.rated.length} ratings; ${persona.note}.`, "");
    lines.push("| Scorer | Spearman ρ | Pearson r | NDCG@10 |", "|---|---|---|---|");
    for (const [name, r] of Object.entries(rows)) {
      const row = `| ${name} | ${fmt(meanSd(r.spearman))} | ${fmt(meanSd(r.pearson))} | ${fmt(meanSd(r.ndcg))} |`;
      lines.push(row);
      console.log(`  ${name.padEnd(32)} ρ ${fmt(meanSd(r.spearman))}   r ${fmt(meanSd(r.pearson))}   NDCG@10 ${fmt(meanSd(r.ndcg))}`);
    }
    lines.push("");

    if (LLM_N > 0 && lastSplit && (uid || persona.name.startsWith(LLM_PERSONA))) lines.push(...(await llmCheck(persona, lastSplit, byKey)), "");
  }

  lines.push("## Blend weight sweep (quick score = w·vector + (1−w)·features)", "", "| w (vector) | mean Spearman ρ over all viewers and splits |", "|---|---|");
  console.log("\nWeight sweep (Spearman, all viewers):");
  let best = { w: 0, rho: -Infinity };
  for (const w of weights) {
    const m = meanSd(grid.get(w)!);
    if (m.mean > best.rho) best = { w, rho: m.mean };
    lines.push(`| ${w.toFixed(1)} | ${fmt(m)} |`);
    console.log(`  w=${w.toFixed(1)}  ρ ${fmt(m)}`);
  }
  lines.push("", `Best w = ${best.w.toFixed(1)} (ρ ${best.rho.toFixed(3)}); shipped quick weights: vector ${QUICK_WEIGHTS.vector}, features ${QUICK_WEIGHTS.features}.`);
  console.log(`\nBest w = ${best.w.toFixed(1)} (ρ ${best.rho.toFixed(3)}). Shipped: vector ${QUICK_WEIGHTS.vector} / features ${QUICK_WEIGHTS.features}.`);

  mkdirSync(".qa/eval", { recursive: true });
  const file = `.qa/eval/match-${NOW.toISOString().slice(0, 10)}${uid ? "-uid" : ""}.md`;
  writeFileSync(file, `${lines.join("\n")}\n`);
  console.log(`\nReport: ${file}`);
}

/** Gemini's judgement on a handful of hidden titles, against the quick estimate on the same titles. */
async function llmCheck(persona: Persona, split: { model: Model; test: Rated[]; train: Rated[] }, byKey: Map<TitleKey, Doc>): Promise<string[]> {
  const { judgeMatch } = await import("@/lib/ai/match-judge");
  const feeling = (r: number) => `rated it ${r}/10 (${r >= 9 ? "loved it" : r >= 7 ? "liked it" : r >= 5 ? "thought it was okay" : "disliked it"})`;
  const loved = split.train.filter((t) => t.rating >= 8).map((t) => byKey.get(t.key)!.title);
  const disliked = split.train.filter((t) => t.rating <= 4).map((t) => byKey.get(t.key)!.title);
  const summary = `Loves: ${loved.slice(0, 12).join(", ")}. Dislikes: ${disliked.slice(0, 8).join(", ")}.`;
  const truth: number[] = [];
  const quick: number[] = [];
  const full: number[] = [];
  for (const t of split.test.slice(0, LLM_N)) {
    const d = byKey.get(t.key)!;
    const neighbours = split.train
      .map((r) => ({ r, sim: dot(d.embedding, byKey.get(r.key)!.embedding) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 6)
      .map(({ r }) => {
        const n = byKey.get(r.key)!;
        return { id: n._id, title: n.title, year: n.year, genres: n.genres, feeling: feeling(r.rating), liked: r.rating >= 7, vibe: n.vibe?.summary ?? null };
      });
    try {
      const j = await judgeMatch({
        summary,
        dna: [],
        answers: null,
        neighbours,
        target: { id: d._id, title: d.title, year: d.year, kind: d.category, genres: d.genres, runtime: null, credits: null, overview: "", vibe: d.vibe?.summary ?? null, themes: d.vibe?.themes ?? [], mood: d.vibe?.mood ?? [], critics: null },
      });
      const vector = split.model.tasteVector && split.model.pct ? percentileRank(dot(split.model.tasteVector, d.embedding), split.model.pct) : null;
      const features = featureScore(toFeatures(d), split.model.fp).score;
      truth.push(t.rating);
      quick.push(blendMatch({ vector, features }));
      full.push(blendMatch({ vector, features, llm: j.llmScore / 100 }));
      process.stdout.write(".");
    } catch (err) {
      process.stdout.write("x");
      void err;
    }
  }
  console.log(`\n  Gemini on ${truth.length} hidden titles: quick ρ ${spearman(quick, truth).toFixed(3)} → full ρ ${spearman(full, truth).toFixed(3)}`);
  return [
    `Gemini judgement on ${truth.length} hidden titles (one split): quick ρ ${spearman(quick, truth).toFixed(3)}, full (with LLM) ρ ${spearman(full, truth).toFixed(3)}; ` +
      `Pearson ${pearson(quick, truth).toFixed(3)} → ${pearson(full, truth).toFixed(3)}.`,
  ];
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
