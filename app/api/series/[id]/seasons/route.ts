import { z } from "zod";
import { route } from "@/lib/http/route";
import { seriesProgress } from "@/lib/series/should-continue";

/** GET /api/series/:id/seasons — the seasons (episode counts), and where your library says you are. */
export const GET = route(
  { auth: "required", input: z.object({ id: z.coerce.number().int().positive() }), rateLimit: { name: "series-read", limit: 60, windowSec: 60 } },
  async ({ user, input }) => seriesProgress(user.uid, input.id),
);
