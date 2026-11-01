import "server-only";
import { titlesCol, VECTOR_INDEX } from "@/lib/db/titles";
import type { TitleKey } from "@/lib/catalog/types";

export type VectorFilter = {
  category?: string | { $in: string[] };
  mediaType?: string;
  genres?: string | { $in: string[] };
  year?: { $gte?: number; $lte?: number };
  originalLanguage?: string | { $in: string[] };
  popularity?: { $lte?: number; $gte?: number };
  voteCount?: { $gte?: number; $lte?: number };
};

/**
 * Atlas $vectorSearch over title embeddings. `exclude` is applied after the
 * search (we over-fetch by its size), which keeps the index filters simple.
 */
export async function vectorSearch(
  queryVector: number[],
  { limit, filter, exclude = [], numCandidates }: { limit: number; filter?: VectorFilter; exclude?: TitleKey[]; numCandidates?: number },
): Promise<{ key: TitleKey; score: number }[]> {
  const col = await titlesCol();
  const skip = new Set(exclude);
  const fetchN = Math.min(limit + skip.size, 1000);
  const rows = await col
    .aggregate<{ _id: TitleKey; score: number }>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          path: "embedding",
          queryVector,
          numCandidates: Math.min(10_000, numCandidates ?? Math.max(fetchN * 15, 200)),
          limit: fetchN,
          ...(filter && Object.keys(filter).length ? { filter } : {}),
        },
      },
      { $project: { _id: 1, score: { $meta: "vectorSearchScore" } } },
    ])
    .toArray();
  return rows.filter((r) => !skip.has(r._id)).slice(0, limit).map((r) => ({ key: r._id, score: r.score }));
}

/**
 * Dot products of `vector` with these titles' stored embeddings, worked out in the database: one
 * number per title comes back instead of its 768-number embedding (about 9 KB on the wire).
 * Titles without an embedding are left out.
 */
export async function dotsWith(vector: ArrayLike<number>, keys: TitleKey[]): Promise<Map<TitleKey, number>> {
  if (!keys.length) return new Map();
  const col = await titlesCol();
  const rows = await col
    .aggregate<{ _id: TitleKey; dot: number }>([
      { $match: { _id: { $in: keys }, "embedding.0": { $exists: true } } },
      {
        $project: {
          dot: {
            $sum: {
              $map: {
                input: { $zip: { inputs: ["$embedding", { $literal: Array.from(vector) }] } },
                as: "p",
                in: { $multiply: [{ $arrayElemAt: ["$$p", 0] }, { $arrayElemAt: ["$$p", 1] }] },
              },
            },
          },
        },
      },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.dot]));
}

/** The embedding for one title, if it has been enriched. */
export async function embeddingOf(key: TitleKey): Promise<number[] | null> {
  const col = await titlesCol();
  const doc = await col.findOne({ _id: key }, { projection: { embedding: 1 } });
  return doc?.embedding?.length ? doc.embedding : null;
}
