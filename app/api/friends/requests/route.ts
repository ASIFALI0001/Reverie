import { z } from "zod";
import { route } from "@/lib/http/route";
import { badRequest, notFound } from "@/lib/http/errors";
import { sendFriendRequest } from "@/lib/social/friends";
import { userByHandle } from "@/lib/social/people";

const Input = z
  .object({
    uid: z.string().min(1).max(128).optional(),
    handle: z.string().min(1).max(40).optional(),
    via: z.enum(["search", "profile"]).default("search"),
  })
  .refine((v) => v.uid || v.handle, "Say who to send it to.");

/** POST /api/friends/requests — ask someone to be friends (by uid or @handle). */
export const POST = route(
  { auth: "required", input: Input, rateLimit: { name: "friend-request", limit: 40, windowSec: 3600, store: "mongo" } },
  async ({ user, input }) => {
    let to = input.uid;
    if (!to) {
      const target = await userByHandle(input.handle!);
      if (!target) throw notFound("That person isn’t available.");
      to = target._id;
    }
    if (to === user.uid) throw badRequest("That’s you.");
    return sendFriendRequest(user.uid, to, input.via);
  },
);
