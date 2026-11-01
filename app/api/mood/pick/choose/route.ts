import { z } from "zod";
import { route } from "@/lib/http/route";
import { chooseMoodPick } from "@/lib/mood/pick";

/** POST /api/mood/pick/choose — which pick they went with (what Mood Search learns from). */
export const POST = route(
  {
    auth: "required",
    input: z.object({ sessionId: z.string().regex(/^[a-f0-9]{24}$/), key: z.string().regex(/^(movie|tv):\d+$/) }),
    rateLimit: { name: "mood-choose", limit: 60, windowSec: 60 },
  },
  async ({ user, input }) => chooseMoodPick(user.uid, input.sessionId, input.key),
);
