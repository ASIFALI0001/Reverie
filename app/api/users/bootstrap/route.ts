import type { NextRequest } from "next/server";
import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User, toPublicUser, type UserDoc } from "@/lib/db/models/User";
import { ensureIdentity } from "@/lib/social/identity";
import { env } from "@/lib/env";

/** Best guess at where the user watches: edge geo header → Accept-Language region → default. */
function inferRegion(req: NextRequest) {
  const geo = req.headers.get("x-vercel-ip-country");
  if (geo && /^[A-Z]{2}$/.test(geo)) return geo;
  const m = (req.headers.get("accept-language") ?? "").match(/[a-z]{2,3}-([A-Z]{2})\b/);
  return m?.[1] ?? env.defaultRegion();
}

function inferLanguages(req: NextRequest) {
  const tags = (req.headers.get("accept-language") ?? "")
    .split(",")
    .map((t) => t.split(";")[0]!.trim().slice(0, 2).toLowerCase())
    .filter((t) => /^[a-z]{2}$/.test(t));
  return [...new Set(tags.length ? tags : ["en"])].slice(0, 3);
}

/** Idempotent: creates the profile on first sign-in, refreshes lastActiveAt after that. */
export const POST = route(
  { auth: "required", rateLimit: { name: "bootstrap", limit: 30, windowSec: 60 } },
  async ({ req, user }) => {
    await connectDb();
    const now = new Date();
    const res = await User.findOneAndUpdate(
      { _id: user.uid },
      {
        $setOnInsert: {
          email: user.email,
          displayName: user.name ?? user.email?.split("@")[0] ?? null,
          photoURL: user.picture,
          avatar: { kind: user.picture ? "photo" : "monogram", tint: "tungsten" },
          region: inferRegion(req),
          languages: inferLanguages(req),
          onboardingDone: false,
          signUpMethod: user.provider,
        },
        $set: { lastActiveAt: now },
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, lean: true },
    );
    // A provisional @handle and an invite code from the first sign-in on (existing users get them here too).
    const doc = await ensureIdentity(user.uid, res.value as UserDoc | null);
    if (!doc) throw new Error("bootstrap upsert returned no document");
    return { user: toPublicUser(doc), isNew: !res.lastErrorObject?.updatedExisting };
  },
);
