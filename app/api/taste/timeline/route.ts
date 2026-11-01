import { route } from "@/lib/http/route";
import { getTimeline } from "@/lib/timeline/timeline";

/** GET /api/taste/timeline — your taste eras, genre share over time and totals (eras named by the model, cached). */
export const GET = route({ auth: "required", rateLimit: { name: "taste-timeline", limit: 30, windowSec: 300, store: "mongo" } }, async ({ user }) => getTimeline(user.uid));
