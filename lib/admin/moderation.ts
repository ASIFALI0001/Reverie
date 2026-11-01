import "server-only";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { forgetAccountStatus } from "@/lib/auth/status";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { tasteCol } from "@/lib/db/taste";
import { forgetAsTwin, refreshTwinEligibility } from "@/lib/twins/compute";
import { forbidden, notFound, unauthorized } from "@/lib/http/errors";
import type { AuthUser } from "@/lib/auth/request-user";

/** Blocking and unblocking need a sign-in within this window (the admin re-enters their password). */
export const RECENT_SIGN_IN_S = 30 * 60;

export function requireRecentSignIn(user: Pick<AuthUser, "authTime">, maxAgeS = RECENT_SIGN_IN_S, now = Date.now()) {
  if (now / 1000 - user.authTime > maxAgeS) throw unauthorized("Confirm it’s you: sign in again to continue.", "reauth_required");
}

export type BlockInput = { reason: string; showReason: boolean; until: Date | null };

/**
 * Block an account. Their data stays; they can still sign in, but every request then lands on
 * /blocked. Refresh tokens are revoked so open sessions end quickly. Admins can't be blocked
 * here, and nobody can block themselves.
 */
export async function blockUser(admin: AuthUser, targetUid: string, input: BlockInput) {
  if (targetUid === admin.uid) throw forbidden("You can’t block your own account.", "self_block");
  if (input.until && input.until.getTime() <= Date.now()) throw forbidden("A temporary block has to end in the future.", "bad_until");
  // The role comes first: an administrator can't be blocked whether or not they have a profile yet.
  const record = await adminAuth()
    .getUser(targetUid)
    .catch(() => null);
  if (record?.customClaims?.admin === true) throw forbidden("Administrators can’t be blocked.", "target_is_admin");
  await connectDb();
  const target = await User.findById(targetUid, { _id: 1 }).lean();
  if (!target) throw notFound("That account doesn’t exist.");

  const at = new Date();
  await User.updateOne(
    { _id: targetUid },
    {
      $set: { status: "blocked", block: { reason: input.reason, showReason: input.showReason, at, by: admin.uid, until: input.until } },
      $push: { blockHistory: { action: "block", reason: input.reason, by: admin.uid, at, until: input.until } },
    },
  );
  forgetAccountStatus(targetUid);
  // Out of Taste Twins while blocked, and out of everyone's twin lists (their data is kept).
  await (await tasteCol()).updateOne({ uid: targetUid }, { $set: { twinEligible: false } });
  await forgetAsTwin(targetUid);
  await adminAuth()
    .revokeRefreshTokens(targetUid)
    .catch((err: unknown) => console.warn("[admin] couldn’t revoke sessions:", err instanceof Error ? err.message : err));
  return { status: "blocked" as const, at, until: input.until };
}

export async function unblockUser(admin: AuthUser, targetUid: string, reason: string) {
  await connectDb();
  const res = await User.updateOne(
    { _id: targetUid },
    {
      $set: { status: "active", block: { reason: null, showReason: false, at: null, by: null, until: null } },
      $push: { blockHistory: { action: "unblock", reason, by: admin.uid, at: new Date(), until: null } },
    },
  );
  if (!res.matchedCount) throw notFound("That account doesn’t exist.");
  forgetAccountStatus(targetUid);
  // Back in Taste Twins if they were in before (it follows their own privacy setting).
  await refreshTwinEligibility(targetUid);
  return { status: "active" as const };
}
