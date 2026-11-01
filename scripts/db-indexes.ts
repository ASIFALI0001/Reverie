/**
 * Create every collection + index Reverie needs, including the Atlas Vector Search index.
 *   npm run db:indexes
 */
import "./_env";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { VECTOR_INDEX } from "@/lib/db/titles";

const dim = Number(process.env.GEMINI_EMBED_DIM ?? 768);

export const VECTOR_DEFINITION = {
  fields: [
    { type: "vector", path: "embedding", numDimensions: dim, similarity: "cosine", quantization: "none" },
    { type: "filter", path: "category" },
    { type: "filter", path: "mediaType" },
    { type: "filter", path: "genres" },
    { type: "filter", path: "year" },
    { type: "filter", path: "originalLanguage" },
    { type: "filter", path: "popularity" },
    { type: "filter", path: "voteCount" },
  ],
};

/**
 * Taste Twins: nearest viewers by taste, among those who take part (see lib/twins). On the social
 * vector (built without titles hidden from friends), so a hidden title never decides who's whose twin.
 */
export const TASTE_VECTOR_INDEX = "taste_vec";
export const TASTE_VECTOR_DEFINITION = {
  fields: [
    { type: "vector", path: "socialVector", numDimensions: dim, similarity: "cosine", quantization: "none" },
    { type: "filter", path: "twinEligible" },
  ],
};

const DAY = 86_400;

async function main() {
  await connectDb();
  const db = mongoose.connection.db!;
  const names = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const all = [
    "users", "titles", "tasteProfiles", "libraryItems", "watchlist", "customShelves", "matchCache",
    "similarCache", "homeCache", "searchHistory", "apiCache", "rateLimits", "quotaLedger",
    // v2: friends, admin, insights
    "friendships", "userBlocks", "recommendations", "sharedLists", "activity", "notifications", "twinConnects",
    "adminAuditLogs", "moodSessions", "tasteSnapshots", "tasteTimelines", "tasteTwins", "whyNotFeedback", "seriesDecisions",
    "usageLedger",
  ];
  for (const n of all) if (!names.has(n)) await db.createCollection(n);

  const ttl = (field: string, seconds = 0) => ({ key: { [field]: 1 }, expireAfterSeconds: seconds });
  const plan: Record<string, Parameters<ReturnType<typeof db.collection>["createIndexes"]>[0]> = {
    titles: [
      { key: { category: 1, popularity: -1 } },
      { key: { "collection.id": 1 } },
      { key: { franchises: 1 } },
      { key: { enrichedAt: 1 } },
      { key: { imdbId: 1 } },
    ],
    libraryItems: [
      { key: { uid: 1, mediaType: 1, tmdbId: 1 }, unique: true },
      { key: { uid: 1, category: 1, status: 1 } },
      { key: { uid: 1, addedAt: -1 } },
    ],
    watchlist: [{ key: { uid: 1, mediaType: 1, tmdbId: 1 }, unique: true }, { key: { uid: 1, addedAt: -1 } }],
    customShelves: [{ key: { uid: 1, order: 1 } }],
    tasteProfiles: [{ key: { uid: 1 }, unique: true }],
    matchCache: [{ key: { uid: 1, key: 1, profileVersion: 1, kind: 1 }, unique: true }, ttl("createdAt", 30 * DAY)],
    similarCache: [ttl("expiresAt")],
    homeCache: [{ key: { uid: 1 } }, ttl("expiresAt")],
    searchHistory: [{ key: { uid: 1, createdAt: -1 } }, ttl("createdAt", 90 * DAY)],
    apiCache: [ttl("expiresAt")],
    rateLimits: [ttl("expiresAt")],
    quotaLedger: [ttl("expiresAt")],
    // ── v2 ──
    users: [
      // Partial, so accounts without one yet never collide.
      { key: { handle: 1 }, unique: true, partialFilterExpression: { handle: { $type: "string" } } },
      { key: { inviteCode: 1 }, unique: true, partialFilterExpression: { inviteCode: { $type: "string" } } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
      { key: { lastActiveAt: -1 } },
    ],
    friendships: [
      { key: { userA: 1, userB: 1 }, unique: true },
      { key: { userA: 1, status: 1 } },
      { key: { userB: 1, status: 1 } },
    ],
    userBlocks: [{ key: { blocker: 1, blocked: 1 }, unique: true }, { key: { blocked: 1 } }],
    recommendations: [{ key: { toUid: 1, createdAt: -1 } }, { key: { fromUid: 1, createdAt: -1 } }],
    sharedLists: [{ key: { memberUids: 1, updatedAt: -1 } }],
    activity: [{ key: { uid: 1, createdAt: -1 } }, ttl("createdAt", 90 * DAY)],
    notifications: [{ key: { uid: 1, createdAt: -1 } }, ttl("createdAt", 180 * DAY)],
    twinConnects: [{ key: { from: 1, to: 1 }, unique: true }, { key: { to: 1 } }],
    adminAuditLogs: [{ key: { at: -1 } }, { key: { targetUid: 1, at: -1 } }, { key: { adminUid: 1, at: -1 } }],
    moodSessions: [{ key: { uid: 1, createdAt: -1 } }],
    tasteSnapshots: [{ key: { uid: 1, periodStart: 1 }, unique: true }],
    tasteTimelines: [{ key: { uid: 1 }, unique: true }],
    tasteTwins: [{ key: { uid: 1 }, unique: true }],
    whyNotFeedback: [{ key: { uid: 1, key: 1 }, unique: true }],
    seriesDecisions: [{ key: { uid: 1, key: 1, at: -1 } }],
    usageLedger: [ttl("expiresAt")],
  };
  // tasteProfiles gets one more: the Taste Twins vector index (below) filters on twinEligible.
  for (const [name, specs] of Object.entries(plan)) {
    await db.collection(name).createIndexes(specs);
    console.log(`✓ indexes  ${name}`);
  }

  // Atlas Vector Search indexes (managed separately from regular ones): titles, and taste profiles for Taste Twins.
  await ensureVectorIndex(db.collection("titles"), VECTOR_INDEX, VECTOR_DEFINITION);
  await ensureVectorIndex(db.collection("tasteProfiles"), TASTE_VECTOR_INDEX, TASTE_VECTOR_DEFINITION);
  await mongoose.disconnect();
}

type SearchIndexInfo = { status?: string; queryable?: boolean; latestDefinition?: unknown };

/** Create or update a vector index, then wait (up to 5 minutes) for it to become queryable. */
async function ensureVectorIndex(col: ReturnType<NonNullable<typeof mongoose.connection.db>["collection"]>, name: string, definition: object) {
  const existing = (await col.listSearchIndexes(name).toArray()) as SearchIndexInfo[];
  if (existing.length === 0) {
    await col.createSearchIndex({ name, type: "vectorSearch", definition });
    console.log(`… creating vector index ${name}`);
  } else if (JSON.stringify(existing[0]?.latestDefinition) !== JSON.stringify(definition)) {
    await col.updateSearchIndex(name, definition);
    console.log(`… updating vector index ${name}`);
  }
  const started = Date.now();
  for (;;) {
    const [idx] = (await col.listSearchIndexes(name).toArray()) as SearchIndexInfo[];
    const status = String(idx?.status ?? "PENDING");
    if (idx?.queryable || status === "READY") {
      console.log(`✓ vector    ${name} (${status}, ${dim} dims)`);
      return;
    }
    if (status === "FAILED") throw new Error(`Vector index ${name} failed: ${JSON.stringify(idx)}`);
    if (Date.now() - started > 5 * 60_000) {
      console.log(`… ${name} still ${status}; it will finish on its own.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
