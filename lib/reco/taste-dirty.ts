import "server-only";
import { tasteCol } from "@/lib/db/taste";
import { ensureProfileDoc, scheduleTasteRebuild } from "@/lib/reco/taste";

/**
 * Note that a user's taste inputs changed (library, ratings, watchlist, onboarding)
 * and queue a debounced rebuild that runs after the response.
 */
export async function markTasteDirty(uid: string) {
  await ensureProfileDoc(uid);
  const col = await tasteCol();
  await col.updateOne({ uid }, { $set: { dirty: true, dirtyAt: new Date() } });
  scheduleTasteRebuild(uid);
}
