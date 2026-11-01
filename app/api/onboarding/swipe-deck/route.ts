import { z } from "zod";
import { route } from "@/lib/http/route";
import { buildSwipeDeck } from "@/lib/reco/swipe-deck";

const csv = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",").filter(Boolean).slice(0, 40) : []));

const Input = z.object({
  formats: csv.pipe(z.array(z.enum(["movie", "series", "anime", "cartoon"]))),
  chips: csv.pipe(z.array(z.string().max(32))),
});

/** GET /api/onboarding/swipe-deck?formats=movie,anime&chips=sci-fi,dark */
export const GET = route(
  { auth: "required", input: Input, rateLimit: { name: "swipe-deck", limit: 30, windowSec: 60 } },
  async ({ user, input }) => ({ cards: await buildSwipeDeck(user.uid, input) }),
);
