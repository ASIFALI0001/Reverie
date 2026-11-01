import { z } from "zod";
import { route } from "@/lib/http/route";
import { removeFriendship } from "@/lib/social/friends";

/** DELETE /api/friends/:uid — unfriend, or cancel/turn down a request between you. */
export const DELETE = route(
  { auth: "required", input: z.object({ uid: z.string().min(1).max(128) }), rateLimit: { name: "friend-remove", limit: 60, windowSec: 60 } },
  async ({ user, input }) => removeFriendship(user.uid, input.uid),
);
