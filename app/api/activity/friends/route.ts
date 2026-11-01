import { route } from "@/lib/http/route";
import { friendsActivity } from "@/lib/social/activity";

/** GET /api/activity/friends — the last few things friends watched, rated or saved (as far as they share). */
export const GET = route({ auth: "required", rateLimit: { name: "activity-read", limit: 120, windowSec: 60 } }, async ({ user }) => ({
  items: await friendsActivity(user.uid),
}));
