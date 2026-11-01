import { route } from "@/lib/http/route";
import { adminStats } from "@/lib/admin/queries";

/** GET /api/admin/stats — the overview dashboard (aggregates only, so not audited). */
export const GET = route({ auth: "admin", rateLimit: { name: "admin-read", limit: 240, windowSec: 60 } }, () => adminStats());
