import { z } from "zod";
import { route } from "@/lib/http/route";
import { removeListMember } from "@/lib/social/shared-lists";

/** DELETE /api/shared-lists/:id/members/:uid — the owner removes someone, or you leave (your own uid). */
export const DELETE = route(
  { auth: "required", input: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), uid: z.string().min(1).max(128) }), rateLimit: { name: "lists-edit", limit: 120, windowSec: 60 } },
  async ({ user, input }) => removeListMember(user.uid, input.id, input.uid),
);
