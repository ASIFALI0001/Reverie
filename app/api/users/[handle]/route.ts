import { z } from "zod";
import { route } from "@/lib/http/route";
import { profileFor } from "@/lib/social/profile";

/** GET /api/users/:handle — a person's profile, as much as you're allowed to see. */
export const GET = route(
  { auth: "required", input: z.object({ handle: z.string().min(1).max(40) }), rateLimit: { name: "profile-read", limit: 120, windowSec: 60 } },
  async ({ user, input }) => profileFor(user.uid, input.handle),
);
