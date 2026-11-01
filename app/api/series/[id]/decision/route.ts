import { z } from "zod";
import { route } from "@/lib/http/route";
import { saveSeriesDecision } from "@/lib/series/should-continue";

/** POST /api/series/:id/decision — kept watching or stopped (it becomes Watching or Dropped in your library). */
export const POST = route(
  {
    auth: "required",
    input: z.object({
      id: z.coerce.number().int().positive(),
      decision: z.enum(["kept", "stopped"]),
      season: z.number().int().min(1).max(100),
      episode: z.number().int().min(1).max(500),
      verdict: z.enum(["keep", "try", "stop"]).nullable().optional(),
    }),
    rateLimit: { name: "series-decision", limit: 30, windowSec: 60 },
  },
  async ({ user, input }) => saveSeriesDecision(user.uid, input.id, input),
);
