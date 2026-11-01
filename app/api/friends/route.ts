import { route } from "@/lib/http/route";
import { friendsOverview } from "@/lib/social/friends";

/** GET /api/friends — friends (with taste match), requests both ways, and people you blocked. */
export const GET = route({ auth: "required", rateLimit: { name: "friends-read", limit: 120, windowSec: 60 } }, async ({ user }) =>
  friendsOverview(user.uid),
);
