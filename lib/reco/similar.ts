import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { CARD_PROJECTION, titlesCol, type TitleDoc } from "@/lib/db/titles";
import { ensureTitle, ensureTitles } from "@/lib/catalog/ensure";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { titleKey, type TitleKey } from "@/lib/catalog/types";
import { getCollection } from "@/lib/sources/tmdb";
import { rerankSimilar, type RerankTitle } from "@/lib/ai/similar-rerank";
import { explainSimilar } from "@/lib/reco/explain";
import { termNames } from "@/lib/reco/match-engine";
import { getCatalogSample } from "@/lib/reco/catalog-sample";
import { similarity } from "@/lib/reco/similarity";
import { keepAlive } from "@/lib/reco/taste";
import { FEATURE_PROJECTION, toFeatures } from "@/lib/reco/title-features";
import { dot, percentileRank, percentileTable } from "@/lib/reco/vector";
import { dotsWith, vectorSearch } from "@/lib/reco/vector-search";

export type SimilarItem = { key: TitleKey; why: string };
export type SimilarCard = SimilarItem & { card: TitleCard };

type CacheDoc = { _id: TitleKey; items: SimilarItem[]; source: "gemini" | "scored"; createdAt: Date; expiresAt: Date };

const SHOW = 12;
const RERANK = 30;
const DAY_MS = 86_400_000;

async function cacheCol() {
  await connectDb();
  return mongoose.connection.db!.collection<CacheDoc>("similarCache");
}

const inflight = new Map<TitleKey, Promise<SimilarItem[]>>();

/**
 * "More like this" for a title: the same for everyone, cached for a week (a day if
 * Gemini couldn't curate it). With `curate: false` a cold cache answers at once from
 * the scored order (no model call) and the curated list is prepared in the background.
 */
export async function getSimilar(key: TitleKey, { curate = true }: { curate?: boolean } = {}): Promise<SimilarCard[]> {
  const cache = await cacheCol();
  const hit = await cache.findOne({ _id: key, expiresAt: { $gt: new Date() } });
  let items = hit?.items;
  if (!items && !curate) {
    items = await computeSimilar(key, { rerank: false });
    keepAlive(getSimilar(key));
  } else if (!items) {
    let task = inflight.get(key);
    if (!task) {
      task = computeSimilar(key, { rerank: true }).finally(() => inflight.delete(key));
      inflight.set(key, task);
    }
    items = await task;
  }
  const titles = await titlesCol();
  const docs = await titles.find({ _id: { $in: items.map((i) => i.key) } }, { projection: CARD_PROJECTION }).toArray();
  const byKey = new Map(docs.map((d) => [d._id, d]));
  return items.flatMap((i) => {
    const d = byKey.get(i.key);
    return d ? [{ ...i, card: toCard(d) }] : [];
  });
}

type CandidateDoc = Pick<TitleDoc, "_id" | "posterPath"> & Parameters<typeof toFeatures>[0] & Pick<TitleDoc, "directors" | "creators" | "topCast">;

async function computeSimilar(key: TitleKey, { rerank }: { rerank: boolean }): Promise<SimilarItem[]> {
  const src = await ensureTitle(key);
  if (!src) return [];
  const titles = await titlesCol();
  const srcEmbedding = (await titles.findOne({ _id: key }, { projection: { embedding: 1 } }))?.embedding ?? null;

  // 1 · Candidates: TMDB's recommendations and similar, the collection, and our nearest neighbours.
  const recs = new Set(src.tmdbRecs ?? []);
  const similar = new Set(src.tmdbSimilar ?? []);
  const keys = new Set<TitleKey>([...recs, ...similar]);
  if (src.collection) {
    try {
      for (const p of (await getCollection(src.collection.id)).parts) keys.add(titleKey("movie", p.id));
    } catch {
      // The collection is a bonus; carry on without it.
    }
  }
  if (srcEmbedding) {
    for (const h of await vectorSearch(srcEmbedding, { limit: 40, filter: { category: src.category }, exclude: [key] })) keys.add(h.key);
  }
  keys.delete(key);

  const projection = { ...FEATURE_PROJECTION, posterPath: 1 } as const;
  const all = [...keys];
  // Closeness to the source is worked out in the database, so candidates' embeddings never travel.
  const [found, dots] = await Promise.all([
    titles.find({ _id: { $in: all } }, { projection }).toArray() as Promise<CandidateDoc[]>,
    srcEmbedding ? dotsWith(srcEmbedding, all) : Promise.resolve(null),
  ]);
  let docs = found;
  const missing = all.filter((k) => !docs.some((d) => d._id === k)).slice(0, 40);
  // The quick path makes do with what the catalog knows; the curated pass fetches the rest.
  if (missing.length && rerank) {
    // TMDB details now (fast); vibes and embeddings in the background, so the next curation is better informed.
    await ensureTitles(missing, { enrich: false, colors: false, jikan: false });
    docs = docs.concat((await titles.find({ _id: { $in: missing } }, { projection }).toArray()) as CandidateDoc[]);
    keepAlive(ensureTitles(missing, { jikan: false }));
  }

  // 2 · Score against the source.
  const sample = srcEmbedding ? await getCatalogSample() : [];
  const table = srcEmbedding && sample.length >= 50 ? percentileTable(sample.map((v) => dot(srcEmbedding, v))) : null;
  const source = toFeatures(src);
  const scored = docs
    .filter((d) => d.posterPath)
    .map((d) => {
      const features = toFeatures(d);
      const sim = dots?.get(d._id);
      const embeddingPct = table && sim != null ? percentileRank(sim, table) : null;
      return { d, features, s: similarity({ source, candidate: features, embeddingPct, inRecs: recs.has(d._id), inSimilar: similar.has(d._id) }) };
    })
    .sort((a, b) => b.s - a.s);
  const top = scored.slice(0, RERANK);

  // 3 · Gemini re-ranks for feel and writes the "why"; our order fills any gaps.
  let items: SimilarItem[] = [];
  let curated: CacheDoc["source"] = "scored";
  if (top.length && rerank) {
    try {
      const order = await rerankSimilar(describe(src), top.map((x) => describe(x.d)));
      items = order.map((o) => ({ key: o.id as TitleKey, why: o.why }));
      curated = "gemini";
    } catch (err) {
      console.warn("[similar] re-rank unavailable, using the scored order:", err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  for (const x of top) {
    if (items.length >= SHOW) break;
    if (items.some((i) => i.key === x.d._id)) continue;
    items.push({ key: x.d._id, why: explainSimilar(source, x.features, new Map([...termNames(src), ...termNames(x.d)])) });
  }
  items = items.slice(0, SHOW);
  // The quick, uncurated answer isn't stored: the curated one is on its way.
  if (!rerank) return items;

  const now = new Date();
  const cache = await cacheCol();
  await cache.updateOne(
    { _id: key },
    { $set: { items, source: curated, createdAt: now, expiresAt: new Date(now.getTime() + (curated === "gemini" ? 7 : 1) * DAY_MS) } },
    { upsert: true },
  );
  return items;
}

function describe(d: Pick<TitleDoc, "_id" | "title" | "year" | "genres" | "vibe" | "directors" | "creators">): RerankTitle {
  const lead = d.directors?.[0]?.name ?? d.creators?.[0]?.name ?? null;
  return {
    id: d._id,
    title: d.title,
    year: d.year,
    genres: d.genres,
    vibe: d.vibe?.summary ?? null,
    themes: d.vibe?.themes ?? [],
    mood: d.vibe?.mood ?? [],
    director: lead ? `${d.directors?.length ? "dir." : "created by"} ${lead}` : null,
  };
}
