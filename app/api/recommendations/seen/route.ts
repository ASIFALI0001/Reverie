import { route } from "@/lib/http/route";
import { markRecommendationsSeen } from "@/lib/social/recommendations";

/** POST /api/recommendations/seen — everything friends sent you has been looked at. */
export const POST = route({ auth: "required", rateLimit: { name: "inbox-seen", limit: 60, windowSec: 60 } }, async ({ user }) => markRecommendationsSeen(user.uid));
