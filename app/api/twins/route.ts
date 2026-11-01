import { route } from "@/lib/http/route";
import { getTwins } from "@/lib/twins/compute";

/** GET /api/twins — your Taste Twins: anonymous (a codename and a gradient) until both of you connect. */
export const GET = route({ auth: "required", rateLimit: { name: "twins", limit: 30, windowSec: 60, store: "mongo" } }, async ({ user }) => getTwins(user.uid));
