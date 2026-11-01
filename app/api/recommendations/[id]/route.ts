import { z } from "zod";
import { route } from "@/lib/http/route";
import { RECOMMENDATION_REACTIONS } from "@/lib/db/models/Social";
import { markRecommendationsSeen, reactToRecommendation } from "@/lib/social/recommendations";

const Input = z
  .object({
    id: z.string().regex(/^[a-f0-9]{24}$/),
    reaction: z.object({ kind: z.enum(RECOMMENDATION_REACTIONS), rating: z.number().int().min(1).max(10).nullable().optional() }).optional(),
    seen: z.literal(true).optional(),
  })
  .refine((v) => v.reaction || v.seen, "Send a reaction, or mark it seen.");

/** PATCH /api/recommendations/:id — reply with a quick reaction, or mark it seen. */
export const PATCH = route(
  { auth: "required", input: Input, rateLimit: { name: "recommend-react", limit: 60, windowSec: 60 } },
  async ({ user, input }) => (input.reaction ? reactToRecommendation(user.uid, input.id, input.reaction) : markRecommendationsSeen(user.uid, [input.id])),
);
