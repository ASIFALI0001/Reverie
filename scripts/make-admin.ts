/**
 * Grant (or revoke) the admin role: a Firebase custom claim `admin: true`, mirrored as
 * role "admin" on the Mongo user for display. The server only ever trusts the claim.
 *   npm run make-admin -- someone@example.com
 *   npm run make-admin -- someone@example.com --revoke
 * The person signs in again (at /admin/login) for the new claim to reach their session.
 */
import "./_env";
import mongoose from "mongoose";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { connectDb } from "@/lib/db/connect";
import { AdminAuditLog } from "@/lib/db/models/Admin";
import { User } from "@/lib/db/models/User";

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const revoke = process.argv.includes("--revoke");
  if (!email) throw new Error("Usage: npm run make-admin -- <email> [--revoke]");

  const record = await adminAuth()
    .getUserByEmail(email)
    .catch(() => null);
  if (!record) throw new Error(`No Reverie account uses ${email}. Sign up first, then run this again.`);

  const claims: Record<string, unknown> = { ...(record.customClaims ?? {}) };
  if (revoke) delete claims.admin;
  else claims.admin = true;
  await adminAuth().setCustomUserClaims(record.uid, claims);
  // Sessions minted before the change keep the old claims until they sign in again.
  if (revoke) await adminAuth().revokeRefreshTokens(record.uid);

  await connectDb();
  await User.updateOne({ _id: record.uid }, { $set: { role: revoke ? "user" : "admin" } });
  await AdminAuditLog.create({
    adminUid: "cli",
    adminEmail: null,
    action: revoke ? "admin.revoke" : "admin.grant",
    targetUid: record.uid,
    details: { email },
  });
  console.log(
    revoke
      ? `✓ ${email} is no longer an admin (their sessions were signed out).`
      : `✓ ${email} is now an admin. Sign in at /admin/login to pick up the role.`,
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
