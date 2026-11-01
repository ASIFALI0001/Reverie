import { z } from "zod";
import { route } from "@/lib/http/route";
import { TitleKeySchema } from "@/lib/api/title-params";
import { getQuickScores } from "@/lib/reco/match-engine";

const Input = z.object({ keys: z.array(TitleKeySchema).min(1).max(80) });

/** POST /api/match/batch { keys } — quick match estimates for lists (no LLM per card). */
export const POST = route(
  { auth: "required", input: Input, rateLimit: { name: "match-batch", limit: 120, windowSec: 60 } },
  async ({ user, input }) => ({ scores: await getQuickScores(user.uid, input.keys) }),
);
