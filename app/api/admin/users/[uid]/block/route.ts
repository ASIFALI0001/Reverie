import { z } from "zod";
import { route } from "@/lib/http/route";
import { audit } from "@/lib/admin/audit";
import { blockUser, requireRecentSignIn } from "@/lib/admin/moderation";

const Input = z.object({
  uid: z.string().min(1).max(128),
  reason: z.string().trim().min(3, "Give a reason (it’s kept in the audit log).").max(500),
  /** Show the reason on the user's /blocked page. */
  showReason: z.boolean().default(false),
  /** Temporary block: ends at this time. */
  until: z.iso.datetime().nullable().optional(),
});

/** POST /api/admin/users/:uid/block — block an account (admin, recent sign-in, audited). */
export const POST = route(
  { auth: "admin", input: Input, rateLimit: { name: "admin-write", limit: 30, windowSec: 60, store: "mongo" } },
  async ({ req, user, input }) => {
    requireRecentSignIn(user);
    const until = input.until ? new Date(input.until) : null;
    const result = await blockUser(user, input.uid, { reason: input.reason, showReason: input.showReason, until });
    await audit(req, user, "user.block", input.uid, { reason: input.reason, showReason: input.showReason, until: until?.toISOString() ?? null });
    return result;
  },
);
