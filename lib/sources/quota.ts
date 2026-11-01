import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";

/** Daily budgets kept safely under each provider's free quota. */
export const DAILY_BUDGET = {
  youtube: 9_000, // 10,000 units/day; search.list = 100, videos.list = 1
  omdb: 950, // 1,000 requests/day on the free key
} as const;

type Service = keyof typeof DAILY_BUDGET;

/** YouTube resets at midnight Pacific; we use the Pacific date for both to keep one rule. */
export function dayStamp() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

/**
 * Atomically reserve `units` from today's budget. Returns false (and reserves
 * nothing) when the budget would be exceeded — callers degrade gracefully.
 */
export async function reserveQuota(service: Service, units: number): Promise<boolean> {
  await connectDb();
  const col = mongoose.connection.db!.collection<{ _id: string; units: number; expiresAt: Date }>("quotaLedger");
  const _id = `${service}:${dayStamp()}`;
  const limit = DAILY_BUDGET[service];
  try {
    const res = await col.findOneAndUpdate(
      { _id, units: { $lte: limit - units } },
      { $inc: { units }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000) } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(res);
  } catch (err) {
    // Duplicate key: the doc exists but is over budget, so the filtered upsert tried to insert.
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

export async function quotaUsed(service: Service): Promise<number> {
  await connectDb();
  const doc = await mongoose.connection.db!
    .collection<{ _id: string; units: number }>("quotaLedger")
    .findOne({ _id: `${service}:${dayStamp()}` });
  return doc?.units ?? 0;
}
