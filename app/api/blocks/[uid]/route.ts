import { z } from "zod";
import { route } from "@/lib/http/route";
import { unblockPerson } from "@/lib/social/friends";

/** DELETE /api/blocks/:uid — unblock someone. */
export const DELETE = route(
  { auth: "required", input: z.object({ uid: z.string().min(1).max(128) }), rateLimit: { name: "user-block", limit: 30, windowSec: 60, store: "mongo" } },
  async ({ user, input }) => unblockPerson(user.uid, input.uid),
);
