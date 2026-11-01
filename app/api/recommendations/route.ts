import { z } from "zod";
import { route } from "@/lib/http/route";
import { NOTE_MAX, sendRecommendation } from "@/lib/social/recommendations";

const Input = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
  to: z.array(z.string().min(1).max(128)).min(1).max(10),
  note: z.string().trim().max(NOTE_MAX).optional(),
});

/** POST /api/recommendations — send a title (and a short note) to one or more friends. */
export const POST = route(
  { auth: "required", input: Input, rateLimit: { name: "recommend", limit: 60, windowSec: 3600, store: "mongo" } },
  async ({ user, input }) => sendRecommendation(user.uid, input),
);
