import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";

export type AiProvider = "gemini" | "groq" | "openrouter";

/** UTC day, the ledger's bucket. */
export const usageDay = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * Count one AI answer for the admin overview: per provider, per day. Fire-and-forget:
 * a missed count is better than a slower answer.
 */
export function recordAiUsage(provider: AiProvider) {
  void (async () => {
    await connectDb();
    await mongoose.connection.db!.collection<{ _id: string; count: number; expiresAt: Date }>("usageLedger").updateOne(
      { _id: `ai:${provider}:${usageDay()}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 40 * 86_400_000) } },
      { upsert: true },
    );
  })().catch(() => {});
}
