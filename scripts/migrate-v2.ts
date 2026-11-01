/**
 * Bring existing accounts up to v2: a provisional @handle and an invite code, privacy
 * defaults, an active status, and the sign-up method (from Firebase). Idempotent: it only
 * fills what's missing, so it's safe to run again.
 *   npm run migrate:v2
 */
import "./_env";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { DEFAULT_PRIVACY, User } from "@/lib/db/models/User";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { ensureIdentity } from "@/lib/social/identity";

async function main() {
  await connectDb();
  const users = await User.find({}, { _id: 1, handle: 1, inviteCode: 1, privacy: 1, status: 1, signUpMethod: 1, displayName: 1, email: 1 }).lean();
  let changed = 0;
  for (const u of users) {
    const before = JSON.stringify([u.handle, u.inviteCode, u.privacy, u.status, u.signUpMethod]);
    await ensureIdentity(u._id);
    const set: Record<string, unknown> = {};
    if (!u.privacy?.friendsSee) set["privacy.friendsSee"] = DEFAULT_PRIVACY.friendsSee;
    if (u.privacy?.inTwins == null) set["privacy.inTwins"] = DEFAULT_PRIVACY.inTwins;
    if (u.privacy?.searchable == null) set["privacy.searchable"] = DEFAULT_PRIVACY.searchable;
    if (!u.status) set.status = "active";
    if (!u.signUpMethod) {
      const record = await adminAuth()
        .getUser(u._id)
        .catch(() => null);
      const provider = record?.providerData[0]?.providerId ?? null;
      if (provider) set.signUpMethod = provider;
    }
    if (Object.keys(set).length) await User.updateOne({ _id: u._id }, { $set: set });
    const after = await User.findById(u._id, { handle: 1, inviteCode: 1, privacy: 1, status: 1, signUpMethod: 1 }).lean();
    if (JSON.stringify([after?.handle, after?.inviteCode, after?.privacy, after?.status, after?.signUpMethod]) !== before) changed++;
  }
  console.log(`✓ migrate:v2  ${users.length} accounts checked, ${changed} updated`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
