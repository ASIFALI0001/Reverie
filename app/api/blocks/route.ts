import { z } from "zod";
import { route } from "@/lib/http/route";
import { blockPerson } from "@/lib/social/friends";

/** POST /api/blocks — block someone: they can't find, see or request you, and you won't see them. */
export const POST = route(
  { auth: "required", input: z.object({ uid: z.string().min(1).max(128) }), rateLimit: { name: "user-block", limit: 30, windowSec: 60, store: "mongo" } },
  async ({ user, input }) => blockPerson(user.uid, input.uid),
);
