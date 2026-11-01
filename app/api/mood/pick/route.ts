import { z } from "zod";
import { route } from "@/lib/http/route";
import { runMood } from "@/lib/mood/pick";
import { MOOD_PRESETS } from "@/lib/mood/target";

const Input = z
  .object({
    preset: z.enum(MOOD_PRESETS.map((p) => p.id) as [string, ...string[]]).nullable().optional(),
    text: z.string().trim().max(200).nullable().optional(),
    time: z.enum(["short", "film", "long", "binge"]),
    company: z.enum(["alone", "partner", "friends", "family"]).nullable().optional(),
    onlyMyServices: z.boolean().optional(),
  })
  .refine((v) => v.preset || v.text, "Pick a mood, or describe one.");

/** POST /api/mood/pick — three picks for this mood, time and company (saved as a mood session). */
export const POST = route(
  { auth: "required", input: Input, rateLimit: { name: "mood-pick", limit: 30, windowSec: 600, store: "mongo" } },
  async ({ user, input }) => runMood(user.uid, input),
);
