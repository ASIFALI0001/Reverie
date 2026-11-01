import "server-only";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { tasteCol } from "@/lib/db/taste";
import { getCatalogSample } from "@/lib/reco/catalog-sample";
import { tasteSimilarity, type SocialTaste } from "@/lib/social/similarity";
import { SHOWN_TO_FRIENDS } from "@/lib/social/visibility";

let meanMemo: { of: Float32Array[]; mean: Float32Array } | null = null;

/** The catalog's average embedding (what every title has in common), recomputed when the sample changes. */
export async function catalogMean(): Promise<Float32Array | null> {
  const sample = await getCatalogSample();
  if (!sample.length) return null;
  if (meanMemo?.of === sample) return meanMemo.mean;
  const mean = new Float32Array(sample[0]!.length);
  for (const v of sample) for (let i = 0; i < mean.length; i++) mean[i]! += v[i]! / sample.length;
  meanMemo = { of: sample, mean };
  return mean;
}

/**
 * Taste match (0–100) between `viewer` and each of `others`, or null where either has too little
 * taste. Both sides use only what friends may see: the social taste (built without hidden titles)
 * and ratings on titles neither has hidden. The score is symmetric, so it never reveals more to
 * one side than the other.
 */
export async function tasteMatches(viewer: string, others: string[]): Promise<Map<string, number | null>> {
  const uids = [...new Set([viewer, ...others])];
  await connectDb();
  const [profiles, ratings, mean] = await Promise.all([
    (await tasteCol())
      .find({ uid: { $in: uids } }, { projection: { uid: 1, socialVector: 1, socialGenreAffinity: 1, tasteVector: 1, genreAffinity: 1 } })
      .toArray(),
    LibraryItem.find({ uid: { $in: uids }, rating: { $ne: null }, ...SHOWN_TO_FRIENDS }, { uid: 1, key: 1, rating: 1 }).lean(),
    catalogMean(),
  ]);
  // Profiles built before the social fields existed had nothing hidden, so the full taste is the social one.
  const taste = new Map<string, SocialTaste>(
    profiles.map((p) => [p.uid, { vector: p.socialVector ?? p.tasteVector ?? null, genres: p.socialGenreAffinity ?? p.genreAffinity ?? [] }]),
  );
  const rated = new Map<string, Map<string, number>>();
  for (const r of ratings) {
    if (!rated.has(r.uid)) rated.set(r.uid, new Map());
    rated.get(r.uid)!.set(r.key, r.rating!);
  }

  const mine = taste.get(viewer);
  const myRatings = rated.get(viewer) ?? new Map<string, number>();
  const out = new Map<string, number | null>();
  for (const o of others) {
    const theirs = taste.get(o);
    if (!mine || !theirs || o === viewer) {
      out.set(o, null);
      continue;
    }
    const shared: [number, number][] = [];
    for (const [key, r] of rated.get(o) ?? []) {
      const m = myRatings.get(key);
      if (m != null) shared.push([m, r]);
    }
    out.set(o, tasteSimilarity(mine, theirs, { mean, sharedRatings: shared })?.score ?? null);
  }
  return out;
}

export async function tasteMatch(viewer: string, other: string): Promise<number | null> {
  return (await tasteMatches(viewer, [other])).get(other) ?? null;
}
