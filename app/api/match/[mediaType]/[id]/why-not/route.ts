import { z } from "zod";
import { route } from "@/lib/http/route";
import { keyOf, TitleParams } from "@/lib/api/title-params";
import { getWhyNot, saveWhyNotFeedback } from "@/lib/reco/why-not-engine";

/**
 * GET /api/match/:mediaType/:id/why-not — why it might not be for you: reasons with the
 * titles they rest on, and one thing you might still enjoy. `?quick=1` (list popovers) never
 * waits for the model: a cached explanation, or the plain facts.
 */
export const GET = route(
  {
    auth: "required",
    input: TitleParams.extend({ quick: z.enum(["1", "true"]).optional() }),
    rateLimit: { name: "why-not", limit: 40, windowSec: 60, store: "mongo" },
  },
  async ({ user, input }) => getWhyNot(user.uid, keyOf(input), { quick: Boolean(input.quick) }),
);

/** POST /api/match/:mediaType/:id/why-not — "Was this right?" (a weak signal for your taste profile). */
export const POST = route(
  { auth: "required", input: TitleParams.extend({ helpful: z.boolean() }), rateLimit: { name: "why-not-feedback", limit: 60, windowSec: 60 } },
  async ({ user, input }) => saveWhyNotFeedback(user.uid, keyOf(input), input.helpful),
);
