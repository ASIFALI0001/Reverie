import { z } from "zod";
import { route } from "@/lib/http/route";
import { audit } from "@/lib/admin/audit";
import { requireRecentSignIn, unblockUser } from "@/lib/admin/moderation";

const Input = z.object({
  uid: z.string().min(1).max(128),
  reason: z.string().trim().min(3, "Give a reason (it’s kept in the audit log).").max(500),
});

/** POST /api/admin/users/:uid/unblock — lift a block (admin, recent sign-in, audited). */
export const POST = route(
  { auth: "admin", input: Input, rateLimit: { name: "admin-write", limit: 30, windowSec: 60, store: "mongo" } },
  async ({ req, user, input }) => {
    requireRecentSignIn(user);
    const result = await unblockUser(user, input.uid, input.reason);
    await audit(req, user, "user.unblock", input.uid, { reason: input.reason });
    return result;
  },
);
