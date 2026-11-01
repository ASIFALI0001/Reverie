import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";

const NamesSchema = z.object({
  eras: z
    .array(
      z.object({
        name: z.string().trim().min(3).max(40),
        line: z.string().trim().min(8).max(170),
      }),
    )
    .min(1)
    .max(8),
});
export type EraNames = z.infer<typeof NamesSchema>["eras"];

const SYSTEM = `You name the chapters of someone's film and TV taste, like chapters of a memoir.
For each era you get its dates, what they watched most (genres with shares), its feel (pace, tone,
complexity), a few favourites, and how sharply it turned from the era before.
name: 2–4 words, evocative and specific to that era's genres and feel ("Neon noir nights",
"Slow-burn sci-fi", "The comfort-rewatch winter"). No dates, no people, no title names, no
quotation marks, no emoji, never "The Era of". Every name different, and different from any in "taken".
line: one sentence of at most 20 words, second person, saying what defined it. Plain and warm, no hype.
Return exactly one entry per era, in the order given.`;

export type EraPrompt = {
  from: string;
  to: string;
  months: number;
  titles: number;
  genres: string[];
  feel: string | null;
  favourites: string[];
  turn: "sharp" | "gentle" | null;
};

export async function generateEraNames(eras: EraPrompt[], taken: string[] = []): Promise<EraNames> {
  const out = await generateJson({
    model: "fast",
    thinking: "low",
    temperature: 0.7,
    timeoutMs: 15_000,
    system: SYSTEM,
    prompt: JSON.stringify({ eras, taken }),
    schema: NamesSchema,
  });
  if (out.eras.length !== eras.length) throw new Error(`asked for ${eras.length} era names, got ${out.eras.length}`);
  const names = out.eras.map((e) => e.name.replace(/["“”]/g, "").trim());
  const all = [...names, ...taken].map((n) => n.toLowerCase());
  if (new Set(all).size !== all.length) throw new Error("era names repeat");
  return out.eras.map((e, i) => ({ name: names[i]!, line: e.line }));
}
