import { z } from "zod";
import { route } from "@/lib/http/route";
import { listUsers } from "@/lib/admin/queries";

const Input = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(["active", "blocked"]).optional(),
  method: z.enum(["password", "google.com"]).optional(),
  joinedFrom: z.iso.date().optional(),
  joinedTo: z.iso.date().optional(),
  sort: z.enum(["joined", "-joined", "active", "-active", "name", "-name"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

/** GET /api/admin/users — the users table: search, filters, sort and pages, all on the server. */
export const GET = route({ auth: "admin", input: Input, rateLimit: { name: "admin-read", limit: 240, windowSec: 60 } }, ({ input }) =>
  listUsers(input),
);
