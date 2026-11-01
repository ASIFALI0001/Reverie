import { z } from "zod";
import { route } from "@/lib/http/route";
import { audit } from "@/lib/admin/audit";
import { adminUserProfile } from "@/lib/admin/queries";

/** GET /api/admin/users/:uid — one account's profile (audited: an admin opened this user). */
export const GET = route(
  { auth: "admin", input: z.object({ uid: z.string().min(1).max(128) }), rateLimit: { name: "admin-read", limit: 240, windowSec: 60 } },
  async ({ req, user, input }) => {
    await audit(req, user, "user.view", input.uid);
    return adminUserProfile(input.uid);
  },
);
