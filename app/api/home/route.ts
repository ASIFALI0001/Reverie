import { route } from "@/lib/http/route";
import { getHomeFeed } from "@/lib/reco/home";

/** GET /api/home — the personal feed: Tonight, then rows (no LLM calls; cached an hour per profile version). */
export const GET = route({ auth: "required", rateLimit: { name: "home", limit: 60, windowSec: 60 } }, async ({ user }) => getHomeFeed(user.uid));
