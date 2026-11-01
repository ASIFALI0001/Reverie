import { z } from "zod";
import { route } from "@/lib/http/route";
import { inviteFor } from "@/lib/social/profile";

/** GET /api/invite/:code — whose invite it is, how your tastes compare, and where you stand. */
export const GET = route(
  { auth: "required", input: z.object({ code: z.string().max(20) }), rateLimit: { name: "invite-read", limit: 60, windowSec: 60 } },
  async ({ user, input }) => inviteFor(user.uid, input.code),
);
