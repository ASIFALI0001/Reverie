/**
 * Taste Twins for everyone: bring each profile's place in the pool up to date, then recompute
 * twins for everyone. The nightly backup to the recompute that follows each profile change.
 *   npm run backfill:twins
 */
import "./_env";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { tasteCol } from "@/lib/db/taste";
import { LibraryItem } from "@/lib/db/models/Library";
import { TasteTwins } from "@/lib/db/models/Insights";
import { computeTwins, refreshTwinEligibility } from "@/lib/twins/compute";

async function main() {
  await connectDb();
  const col = await tasteCol();

  // Profiles built before the social fields existed: with nothing hidden, the full taste is the
  // social one. Anyone who has hidden something gets it right at their next rebuild instead.
  const old = await col.find({ socialVector: { $exists: false }, "tasteVector.0": { $exists: true } }, { projection: { uid: 1, tasteVector: 1, genreAffinity: 1 } }).toArray();
  let copied = 0;
  for (const p of old) {
    if (await LibraryItem.exists({ uid: p.uid, hiddenFromFriends: true })) continue;
    await col.updateOne({ uid: p.uid }, { $set: { socialVector: p.tasteVector, socialGenreAffinity: p.genreAffinity } });
    copied++;
  }

  const uids = (await col.find({}, { projection: { uid: 1 } }).toArray()).map((p) => p.uid);
  let inPool = 0;
  for (const uid of uids) if ((await refreshTwinEligibility(uid)).eligible) inPool++;
  // The vector index picks up pool changes within seconds; give it a moment before searching it.
  await new Promise((r) => setTimeout(r, 5000));
  for (const uid of uids) await computeTwins(uid);
  const withTwins = await TasteTwins.countDocuments({ "twins.0": { $exists: true } });
  console.log(`✓ backfill:twins  ${uids.length} profiles, ${copied} given a social taste, ${inPool} in the pool, ${withTwins} with twins`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
