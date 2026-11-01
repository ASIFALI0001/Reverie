import { z } from "zod";
import { route } from "@/lib/http/route";
import { swapMoodPick } from "@/lib/mood/pick";

/** POST /api/mood/pick/swap — "Not this": the next pick for the same mood (null when none are left). */
export const POST = route(
  {
    auth: "required",
    input: z.object({ sessionId: z.string().regex(/^[a-f0-9]{24}$/), key: z.string().regex(/^(movie|tv):\d+$/) }),
    rateLimit: { name: "mood-swap", limit: 60, windowSec: 60 },
  },
  async ({ user, input }) => ({ pick: await swapMoodPick(user.uid, input.sessionId, input.key) }),
);
