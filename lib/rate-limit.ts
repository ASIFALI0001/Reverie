import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { ApiError } from "@/lib/http/errors";

export type RateRule = {
  /** Bucket name, e.g. "ask" or "match". */
  name: string;
  limit: number;
  windowSec: number;
  /**
   * "memory" is per server instance (cheap, fine for ordinary routes);
   * "mongo" is shared across instances — use it for routes that spend Gemini/YouTube quota.
   */
  store?: "memory" | "mongo";
};

const memory = new Map<string, { count: number; resetAt: number }>();

function tooMany(retryAfter: number): never {
  throw new ApiError(429, "rate_limited", "You’re going a little fast. Try again in a moment.", { retryAfter });
}

export async function enforceRateLimit(rule: RateRule, subject: string) {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

  if ((rule.store ?? "memory") === "memory") {
    const key = `${rule.name}:${subject}`;
    const entry = memory.get(key);
    if (!entry || entry.resetAt <= now) {
      memory.set(key, { count: 1, resetAt });
      if (memory.size > 10_000) {
        for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      }
      return;
    }
    if (++entry.count > rule.limit) tooMany(retryAfter);
    return;
  }

  await connectDb();
  const res = await mongoose.connection.db!.collection<{ _id: string; count: number; expiresAt: Date }>("rateLimits").findOneAndUpdate(
    { _id: `${rule.name}:${subject}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt + 60_000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((res?.count ?? 0) > rule.limit) tooMany(retryAfter);
}
