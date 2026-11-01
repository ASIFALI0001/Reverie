/**
 * Build monthly taste snapshots for every account (for the Taste DNA timeline). Only
 * months whose library entries changed are rebuilt, so re-running is cheap.
 *   npm run backfill:snapshots
 *   npm run backfill:snapshots -- --uid=<firebase uid>
 */
import "./_env";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { rebuildSnapshots } from "@/lib/timeline/build";

const only = process.argv.find((a) => a.startsWith("--uid="))?.slice(6);

async function main() {
  await connectDb();
  const uids = only ? [only] : (await User.find({}, { _id: 1 }).lean()).map((u) => u._id);
  let months = 0;
  let rebuilt = 0;
  for (const uid of uids) {
    const r = await rebuildSnapshots(uid);
    months += r.months;
    rebuilt += r.rebuilt;
  }
  console.log(`✓ backfill:snapshots  ${uids.length} accounts, ${months} months, ${rebuilt} rebuilt`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
