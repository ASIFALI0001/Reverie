import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";

type CacheDoc<T> = { _id: string; value: T; freshUntil: Date; expiresAt: Date };

/** Stale copies stay around this long after going stale — served if the upstream is down. */
const STALE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  details: 7 * 24 * 3600,
  trending: 6 * 3600,
  list: 6 * 3600,
  providers: 24 * 3600,
  youtube: 7 * 24 * 3600,
  omdb: 7 * 24 * 3600,
  jikan: 7 * 24 * 3600,
  search: 3600,
  meta: 30 * 24 * 3600,
} as const;

/**
 * Read-through cache in Mongo (`apiCache`, TTL-indexed on expiresAt).
 * Concurrent callers share one upstream request; on upstream failure a stale
 * copy (if any) is returned instead of an error.
 */
export async function cached<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const task = (async () => {
    await connectDb();
    const col = mongoose.connection.db!.collection<CacheDoc<T>>("apiCache");
    const hit = await col.findOne({ _id: key });
    if (hit && hit.freshUntil > new Date()) return hit.value;
    try {
      const value = await fetcher();
      const now = Date.now();
      await col.updateOne(
        { _id: key },
        { $set: { value, freshUntil: new Date(now + ttlSec * 1000), expiresAt: new Date(now + ttlSec * 1000 + STALE_GRACE_MS) } },
        { upsert: true },
      );
      return value;
    } catch (err) {
      if (hit) {
        console.warn(`[cache] serving stale ${key}:`, err instanceof Error ? err.message : err);
        return hit.value;
      }
      throw err;
    }
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}
