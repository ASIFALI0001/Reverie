import { z } from "zod";
import { route } from "@/lib/http/route";
import { listAudit } from "@/lib/admin/queries";

const Input = z.object({
  /** Comma-separated actions; one ending in "*" is a prefix ("user.view*", "user.block,user.unblock"). */
  action: z.string().trim().max(120).optional(),
  admin: z.string().max(128).optional(),
  target: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

/** GET /api/admin/audit — every admin action and look at a user's data, newest first. */
export const GET = route({ auth: "admin", input: Input, rateLimit: { name: "admin-read", limit: 240, windowSec: 60 } }, ({ input }) => listAudit(input));
