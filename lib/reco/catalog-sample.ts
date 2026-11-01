import "server-only";
import mongoose, { mongo } from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { titlesCol } from "@/lib/db/titles";
import { embedModelId } from "@/lib/ai/embed";

const SAMPLE_SIZE = 1200;
const MAX_AGE_MS = 7 * 86_400_000;
// While the catalog is still filling up, refresh a small sample daily.
const SMALL_MAX_AGE_MS = 86_400_000;
const MEMO_MS = 6 * 3_600_000;

type SampleDoc = { _id: string; model: string; dim: number; n: number; vectors: mongo.Binary; builtAt: Date };

let memo: { vectors: Float32Array[]; at: number } | null = null;

/**
 * A random sample of catalog embeddings, used to turn a raw cosine into a
 * percentile ("better than 87% of the catalog"). Stored as one Float32 blob
 * (~3.7 MB) so a cold server loads it in a single read instead of 1,200 documents.
 */
export async function getCatalogSample(): Promise<Float32Array[]> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.vectors;
  await connectDb();
  const meta = mongoose.connection.db!.collection<SampleDoc>("meta");
  const model = embedModelId();

  const doc = await meta.findOne({ _id: "catalogSample" });
  const age = doc ? Date.now() - doc.builtAt.getTime() : Infinity;
  const fresh = doc && doc.model === model && age < (doc.n < SAMPLE_SIZE ? SMALL_MAX_AGE_MS : MAX_AGE_MS);
  const vectors = fresh ? unpack(doc) : await rebuild(meta, model);
  memo = { vectors, at: Date.now() };
  return vectors;
}

function unpack(doc: SampleDoc): Float32Array[] {
  const buf = doc.vectors.buffer;
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return Array.from({ length: doc.n }, (_, i) => all.subarray(i * doc.dim, (i + 1) * doc.dim));
}

async function rebuild(meta: mongo.Collection<SampleDoc>, model: string): Promise<Float32Array[]> {
  const titles = await titlesCol();
  const rows = await titles
    .aggregate<{ embedding: number[] }>([
      { $match: { "embedding.0": { $exists: true }, embedModel: model } },
      { $sample: { size: SAMPLE_SIZE } },
      { $project: { _id: 0, embedding: 1 } },
    ])
    .toArray();
  const dim = rows[0]?.embedding.length ?? 0;
  const flat = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => flat.set(r.embedding, i * dim));
  if (rows.length) {
    await meta.updateOne(
      { _id: "catalogSample" },
      { $set: { model, dim, n: rows.length, vectors: new mongo.Binary(Buffer.from(flat.buffer)), builtAt: new Date() } },
      { upsert: true },
    );
  }
  return Array.from({ length: rows.length }, (_, i) => flat.subarray(i * dim, (i + 1) * dim));
}
