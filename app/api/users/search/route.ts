import { z } from "zod";
import { route } from "@/lib/http/route";
import { searchPeople } from "@/lib/social/profile";

/** GET /api/users/search?q= — find people by @handle or name (only those who allow it). */
export const GET = route(
  { auth: "required", input: z.object({ q: z.string().trim().max(60).default("") }), rateLimit: { name: "people-search", limit: 60, windowSec: 60 } },
  async ({ user, input }) => ({ results: await searchPeople(user.uid, input.q) }),
);
