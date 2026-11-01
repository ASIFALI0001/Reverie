import "server-only";
import mongoose from "mongoose";
import { env } from "@/lib/env";

// One connection per server instance, reused across hot reloads and requests.
const g = globalThis as unknown as { __reverieMongo?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  if (!g.__reverieMongo) {
    mongoose.set("strictQuery", true);
    g.__reverieMongo = mongoose
      .connect(env.mongoUri(), {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
      })
      .catch((err: unknown) => {
        g.__reverieMongo = undefined; // allow the next request to retry
        throw err;
      });
  }
  return g.__reverieMongo;
}
