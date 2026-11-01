import { z } from "zod";
import { route } from "@/lib/http/route";
import { acceptInvite } from "@/lib/social/profile";

/** POST /api/invite/:code/accept — send the inviter a friend request (or accept theirs). */
export const POST = route(
  { auth: "required", input: z.object({ code: z.string().max(20) }), rateLimit: { name: "friend-request", limit: 40, windowSec: 3600, store: "mongo" } },
  async ({ user, input }) => acceptInvite(user.uid, input.code),
);
