import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";

const VerdictSchema = z.object({
  verdict: z.enum(["keep", "try", "stop"]),
  tryUntil: z.object({ season: z.number().int().min(1), episode: z.number().int().min(1) }).nullable(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().trim().min(8).max(220)).min(2).max(3),
});
export type SeriesVerdictDraft = z.infer<typeof VerdictSchema>;

const SYSTEM = `Someone is partway through a series and losing interest. Tell them, WITHOUT SPOILERS, whether it is
likely to get better for their taste, and roughly from where.
verdict: "keep" (it gets better or stays good for them), "try" (give it until a specific later episode: set tryUntil),
or "stop" (unlikely to win them over). confidence: 0–1, honest.
reasons: 2–3, each at most 22 words, second person, about ONLY pace, tone, quality trend (the ratings given) and
genre or format shifts.
SPOILER RULES (absolute):
- Never mention characters' fates, deaths, twists, reveals, betrayals, romances or relationships, or any specific
  event after their current episode. Never quote or paraphrase later episode descriptions.
- Never name a character, place or group that hasn't appeared by their current episode.
- The later episode descriptions are given only so you can judge pace, tone and genre. Treat them as secret.
If they said what's bothering them, speak to that directly.`;

export type SeriesPrompt = {
  title: string;
  genres: string[];
  overview: string;
  taste: { summary: string | null; dna: string[] };
  position: { season: number; episode: number };
  bothering: string | null;
  trend: { watchedAvg: number | null; nextAvg: number | null; restAvg: number | null; pickup: { season: number; episode: number } | null; episodesAhead: number };
  seasonAverages: { season: number; avg: number | null }[];
  later: { season: number; episode: number; rating: number | null; overview: string }[];
};

export async function generateSeriesVerdict(input: SeriesPrompt, avoid: string[] = []): Promise<SeriesVerdictDraft> {
  return generateJson({
    model: "fast",
    thinking: "low",
    temperature: 0.3,
    timeoutMs: 15_000,
    system: SYSTEM,
    prompt: JSON.stringify({
      ...input,
      ...(avoid.length ? { yourLastAnswerBrokeTheRules: avoid, fix: "Rewrite the reasons using only pace, tone, quality and genre. No names, no events." } : {}),
    }),
    schema: VerdictSchema,
  });
}
