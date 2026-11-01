import { z } from "zod";
import { route } from "@/lib/http/route";
import { pickForTonight } from "@/lib/social/shared-lists";

/** POST /api/shared-lists/:id/pick — "Pick for us tonight": the best combined match, and why. */
export const POST = route(
  { auth: "required", input: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }), rateLimit: { name: "lists-pick", limit: 20, windowSec: 300, store: "mongo" } },
  async ({ user, input }) => ({ pick: await pickForTonight(user.uid, input.id) }),
);
