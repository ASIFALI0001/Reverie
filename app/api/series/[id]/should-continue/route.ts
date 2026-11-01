import { z } from "zod";
import { route } from "@/lib/http/route";
import { shouldContinue } from "@/lib/series/should-continue";

/** POST /api/series/:id/should-continue — a spoiler-free "keep going?" verdict for where you are. */
export const POST = route(
  {
    auth: "required",
    input: z.object({
      id: z.coerce.number().int().positive(),
      season: z.number().int().min(1).max(100),
      episode: z.number().int().min(1).max(500),
      reason: z.string().trim().max(200).nullable().optional(),
    }),
    rateLimit: { name: "should-continue", limit: 20, windowSec: 600, store: "mongo" },
  },
  async ({ user, input }) => shouldContinue(user.uid, input.id, input),
);
