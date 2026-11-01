import { z } from "zod";
import { route } from "@/lib/http/route";
import { compareWith } from "@/lib/social/compare";

/** GET /api/friends/:uid/compare — where your tastes agree and clash, both radars, and shared titles. */
export const GET = route(
  { auth: "required", input: z.object({ uid: z.string().min(1).max(128) }), rateLimit: { name: "compare", limit: 60, windowSec: 60 } },
  async ({ user, input }) => compareWith(user.uid, input.uid),
);
