import "server-only";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

export type BlockInfo = { reason: string | null; showReason: boolean; at: Date | null; until: Date | null };
export type AccountStatus = { blocked: false } | { blocked: true; block: BlockInfo };

/** How long one server instance trusts a status read. A block clears it at once (forgetAccountStatus). */
const TTL_MS = 30_000;
const cache = new Map<string, { value: AccountStatus; at: number }>();

/** Is a block still in force at `now`? Temporary blocks end at `until`. */
export function blockInForce(status: string | null | undefined, until: Date | null | undefined, now = new Date()): boolean {
  return status === "blocked" && (!until || new Date(until).getTime() > now.getTime());
}

/**
 * Whether an administrator has blocked this account. Checked on every protected API request
 * (through route()), so a block takes effect within seconds; a temporary block that has run
 * out is lifted here, the first time it's checked after its end date.
 */
export async function accountStatus(uid: string): Promise<AccountStatus> {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  await connectDb();
  const user = await User.findById(uid, { status: 1, block: 1 }).lean();
  let value: AccountStatus = { blocked: false };
  if (user?.status === "blocked") {
    const until = user.block?.until ?? null;
    if (blockInForce(user.status, until)) {
      value = {
        blocked: true,
        block: { reason: user.block?.reason ?? null, showReason: Boolean(user.block?.showReason), at: user.block?.at ?? null, until },
      };
    } else {
      await User.updateOne(
        { _id: uid, status: "blocked", "block.until": { $lte: new Date() } },
        {
          $set: { status: "active" },
          $push: { blockHistory: { action: "unblock", reason: "Temporary block ended", by: "system", at: new Date(), until: null } },
        },
      );
    }
  }
  cache.set(uid, { value, at: Date.now() });
  if (cache.size > 20_000) cache.clear();
  return value;
}

export function forgetAccountStatus(uid: string) {
  cache.delete(uid);
}
