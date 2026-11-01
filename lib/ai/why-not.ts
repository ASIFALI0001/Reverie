import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import type { JudgeTarget } from "@/lib/ai/match-judge";
import type { WhyNotDraft } from "@/lib/reco/why-not";

const WhyNotSchema = z.object({
  negatives: z
    .array(z.object({ reason: z.string().min(8).max(200), evidence: z.array(z.string()).max(4) }))
    .min(1)
    .max(3),
  positive: z.string().max(200).nullable(),
});

const SYSTEM = `You explain honestly why someone might NOT enjoy a film or series, using only their own
watching history and the facts given. Honest negatives make the positive scores trustworthy.
Rules:
- Give 2 or 3 reasons (just 1 if only one is real). Each at most 18 words, specific, in the second person ("you").
- Use ONLY the provided evidence titles and facts. Never invent titles, ratings, dates or history.
- In "evidence", list the ids of the evidence titles a reason rests on (ids from the list only; [] when it rests on a fact).
- Prefer concrete comparisons: "You dropped two slow-burn dramas like this one" beats "You may not like the pacing".
- No spoilers beyond the overview. Friendly and plain: never insult the title or the viewer's taste.
- positive: one short point (at most 18 words) about what they might still enjoy, grounded in what they liked; null if there's nothing honest to say.`;

export type WhyNotEvidence = { id: string; title: string; year: number | null; genres: string[]; feeling: string; reactions: string | null; vibe: string | null };

export async function generateWhyNot(input: { target: JudgeTarget; disliked: WhyNotEvidence[]; liked: WhyNotEvidence[]; facts: string[] }): Promise<WhyNotDraft> {
  return generateJson({
    model: "fast",
    thinking: "low",
    temperature: 0.3,
    timeoutMs: 15_000,
    system: SYSTEM,
    prompt: JSON.stringify({
      title: input.target,
      theyDidNotEnjoy: input.disliked,
      theyEnjoyed: input.liked,
      mismatchFacts: input.facts,
    }),
    schema: WhyNotSchema,
  });
}
