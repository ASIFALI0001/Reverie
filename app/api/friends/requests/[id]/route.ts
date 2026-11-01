import { z } from "zod";
import { route } from "@/lib/http/route";
import { respondToRequest } from "@/lib/social/friends";

/** PATCH /api/friends/requests/:id — accept or decline a request someone sent you. */
export const PATCH = route(
  {
    auth: "required",
    input: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), action: z.enum(["accept", "decline"]) }),
    rateLimit: { name: "friend-respond", limit: 60, windowSec: 60 },
  },
  async ({ user, input }) => respondToRequest(user.uid, input.id, input.action),
);
