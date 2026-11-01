import "server-only";
import { connectDb } from "@/lib/db/connect";
import { User, type UserDoc } from "@/lib/db/models/User";
import { handleCandidates, handleProblem, normalizeHandle, suggestHandleBase } from "@/lib/social/handles";
import { badRequest } from "@/lib/http/errors";
import { newInviteCode } from "@/lib/social/invite";

const isDuplicate = (err: unknown) => (err as { code?: number })?.code === 11000;

/** The first free handle among the candidates for this base (a timestamped one if all are taken). */
export async function uniqueHandle(base: string, except?: string): Promise<string> {
  await connectDb();
  for (const candidate of handleCandidates(base, 12)) {
    if (!(await User.exists({ handle: candidate, ...(except ? { _id: { $ne: except } } : {}) }))) return candidate;
  }
  return `${base.slice(0, 12)}${Date.now().toString(36).slice(-6)}`;
}

/**
 * Make sure a user has a handle and an invite code. Handles assigned here are provisional
 * (`handleChosen` stays false) until the user confirms or picks one. Safe to call on every
 * sign-in: it only writes what's missing, and retries if another request took the same handle.
 */
export async function ensureIdentity(uid: string, known?: UserDoc | null): Promise<UserDoc | null> {
  await connectDb();
  let user = known ?? (await User.findById(uid).lean<UserDoc>());
  for (let attempt = 0; user && (!user.handle || !user.inviteCode) && attempt < 4; attempt++) {
    const set: Record<string, string> = {};
    if (!user.handle) set.handle = await uniqueHandle(suggestHandleBase(user.displayName, user.email));
    if (!user.inviteCode) set.inviteCode = newInviteCode();
    try {
      // Only fill fields that are still missing (another request may have done it meanwhile).
      const filter: Record<string, unknown> = { _id: uid };
      if (set.handle) filter.handle = { $exists: false };
      if (set.inviteCode) filter.inviteCode = { $exists: false };
      await User.updateOne(filter, { $set: set });
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
    user = await User.findById(uid).lean<UserDoc>();
  }
  return user;
}

export type HandleCheck = { handle: string; problem: string | null; available: boolean };

/** Is this handle usable by this user? (Their own current handle counts as available.) */
export async function checkHandle(uid: string, raw: string): Promise<HandleCheck> {
  const handle = normalizeHandle(raw);
  const problem = handleProblem(handle);
  if (problem) return { handle, problem, available: false };
  await connectDb();
  const taken = await User.exists({ handle, _id: { $ne: uid } });
  return { handle, problem: taken ? "That handle is taken." : null, available: !taken };
}

/** Pick (or confirm) a handle. Once chosen, the one-time prompt doesn't come back. */
export async function setHandle(uid: string, raw: string): Promise<{ handle: string }> {
  const check = await checkHandle(uid, raw);
  if (!check.available) throw badRequest(check.problem ?? "That handle can’t be used.");
  await connectDb();
  try {
    await User.updateOne({ _id: uid }, { $set: { handle: check.handle, handleChosen: true } });
  } catch (err) {
    if (isDuplicate(err)) throw badRequest("That handle was just taken. Try another.");
    throw err;
  }
  return { handle: check.handle };
}
