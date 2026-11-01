import { z } from "zod";
import { route } from "@/lib/http/route";
import { addListMembers } from "@/lib/social/shared-lists";

/** POST /api/shared-lists/:id/members — add friends to it (owner). */
export const POST = route(
  {
    auth: "required",
    input: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), uids: z.array(z.string().min(1).max(128)).min(1).max(7) }),
    rateLimit: { name: "lists-edit", limit: 120, windowSec: 60 },
  },
  async ({ user, input }) => addListMembers(user.uid, input.id, input.uids),
);
