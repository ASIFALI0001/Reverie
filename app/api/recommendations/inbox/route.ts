import { route } from "@/lib/http/route";
import { recommendationInbox } from "@/lib/social/recommendations";

/** GET /api/recommendations/inbox — titles friends sent you, with your own match for each. */
export const GET = route({ auth: "required", rateLimit: { name: "inbox-read", limit: 120, windowSec: 60 } }, async ({ user }) =>
  recommendationInbox(user.uid),
);
