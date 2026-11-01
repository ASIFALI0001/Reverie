import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User, toPublicUser, type UserDoc } from "@/lib/db/models/User";
import { AVATAR_TINTS, type AvatarTint } from "@/lib/avatar";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { deleteAllUserData } from "@/lib/db/user-data";
import { FRESH_SIGN_IN_S, HINT_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { notFound, unauthorized } from "@/lib/http/errors";
import { keepAlive } from "@/lib/reco/taste";
import { computeTwins, refreshTwinEligibility } from "@/lib/twins/compute";

export const GET = route({ auth: "required" }, async ({ user }) => {
  await connectDb();
  const doc = await User.findById(user.uid).lean<UserDoc>();
  if (!doc) throw notFound("No profile yet. Sign in again to create it.");
  return toPublicUser(doc);
});

const Patch = z
  .object({
    displayName: z.string().trim().min(1, "Enter a name.").max(80).optional(),
    avatar: z
      .object({ kind: z.enum(["photo", "monogram"]), tint: z.enum(AVATAR_TINTS as [AvatarTint, ...AvatarTint[]]) })
      .optional(),
    region: z
      .string()
      .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code.")
      .transform((s) => s.toUpperCase())
      .optional(),
    languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(8).optional(),
    /** Settings → Privacy (any subset). */
    privacy: z
      .object({
        friendsSee: z.enum(["everything", "ratings", "nothing"]).optional(),
        inTwins: z.boolean().optional(),
        searchable: z.boolean().optional(),
      })
      .strict()
      .optional(),
    /** The one-time "compare with a friend?" card was seen or dismissed. */
    invitePromptSeen: z.literal(true).optional(),
    /** My services: TMDB provider ids, for "only what's on my services". */
    services: z.array(z.number().int().positive()).max(40).optional(),
  })
  .strict();

export const PATCH = route(
  { auth: "required", input: Patch, rateLimit: { name: "me-write", limit: 30, windowSec: 60 } },
  async ({ user, input }) => {
    await connectDb();
    // Privacy is merged field by field, so changing one setting never resets the others.
    const { privacy, ...rest } = input;
    const set: Record<string, unknown> = { ...rest };
    for (const [k, v] of Object.entries(privacy ?? {})) if (v !== undefined) set[`privacy.${k}`] = v;
    const doc = await User.findByIdAndUpdate(user.uid, { $set: set }, { returnDocument: "after", lean: true });
    if (!doc) throw notFound("No profile yet.");
    if (input.displayName) await adminAuth().updateUser(user.uid, { displayName: input.displayName });
    // Leaving Taste Twins takes effect at once (out of everyone's lists too); joining finds twins straight after.
    if (privacy?.inTwins !== undefined) {
      const { eligible } = await refreshTwinEligibility(user.uid);
      if (eligible) keepAlive(computeTwins(user.uid));
    }
    return toPublicUser(doc as UserDoc);
  },
);

/**
 * Delete the account and every trace of it. Requires a sign-in within the last
 * five minutes, so a borrowed laptop or stolen token can't do it silently.
 */
export const DELETE = route(
  { auth: "required", rateLimit: { name: "me-delete", limit: 5, windowSec: 300 } },
  async ({ user }) => {
    if (user.via !== "bearer" || Date.now() / 1000 - user.authTime > FRESH_SIGN_IN_S) {
      throw unauthorized("Confirm it’s you by signing in again, then delete.", "reauth_required");
    }
    const removed = await deleteAllUserData(user.uid);
    await adminAuth().deleteUser(user.uid);
    const res = NextResponse.json({ data: { deleted: true, rows: removed } });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(HINT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  },
);
