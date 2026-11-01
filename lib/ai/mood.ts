import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { cached } from "@/lib/cache/cached";
import type { MoodTarget } from "@/lib/mood/target";

const unit = z.number().min(0).max(1);
const words = (max: number) => z.array(z.string().trim().min(2).max(40)).max(max);

const TargetSchema = z.object({
  targetVibe: z.object({ pace: unit, tone: unit, complexity: unit }),
  moods: words(6),
  themesWanted: words(6),
  themesAvoid: words(6),
  formats: z.array(z.enum(["movie", "series", "anime", "cartoon"])).max(4),
  runtimeMax: z.number().int().min(10).max(400).nullable(),
  allowRewatch: z.boolean(),
  genres: z.array(z.string().trim().max(30)).max(4),
  query: z.string().trim().min(5).max(200),
});

const TARGET_SYSTEM = `You turn how someone feels right now into a search target for films and series.
Scales (decimals 0–1): pace 0 = slow-burn, 1 = fast and loud; tone 0 = light and comforting, 1 = dark and heavy;
complexity 0 = easy watch, 1 = demanding, makes you think.
- moods: 2–5 lowercase adjectives for how it should feel ("cozy", "tense", "bittersweet").
- themesWanted / themesAvoid: short lowercase phrases ("found family", "grief"); avoid only what they clearly don't want.
- formats: only if they named one (movie, series, anime, cartoon); otherwise [].
- runtimeMax: minutes, only if they gave a time limit; otherwise null.
- allowRewatch: true only if they want something they've already seen.
- genres: up to 3 TMDB genre names that fit (e.g. Comedy, Horror, Science Fiction, Romance, Documentary).
- query: one sentence describing the ideal pick, for a similarity search (no titles).
Read the mood generously and literally; never moralise.`;

/** Free text → target. Cached by the text, so the same words never cost a second call. */
export async function moodTargetFromText(text: string): Promise<MoodTarget> {
  const normal = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
  const id = createHash("sha1").update(normal).digest("hex").slice(0, 20);
  return cached(`mood:target:${id}`, 30 * 24 * 3600, () =>
    generateJson({ model: "fast", thinking: "minimal", temperature: 0.3, timeoutMs: 9000, system: TARGET_SYSTEM, prompt: `Mood: ${normal}`, schema: TargetSchema }),
  );
}

const RerankSchema = z.object({
  picks: z
    .array(z.object({ id: z.string(), reason: z.string().trim().min(6).max(180) }))
    .min(1)
    .max(8),
});

const RERANK_SYSTEM = `You choose what someone should watch tonight from a shortlist that already fits their taste.
Pick the 6 best for their mood, time and company, best first. Keep them varied: never two from the same
franchise, and mix it up rather than six of one kind. For each, one line (at most 16 words) saying why it fits
this mood tonight: specific to the title's feel, second person, no spoilers, no hype words, no emoji.
Use only ids from the shortlist.`;

export type RerankCandidate = { id: string; title: string; year: number | null; kind: string; runtime: string | null; genres: string[]; feel: string | null; match: number | null };

export async function rerankForMood(input: { mood: string; time: string; company: string | null; candidates: RerankCandidate[] }) {
  return generateJson({
    model: "fast",
    thinking: "low",
    temperature: 0.4,
    timeoutMs: 15_000,
    system: RERANK_SYSTEM,
    prompt: JSON.stringify({ mood: input.mood, time: input.time, company: input.company ?? "not said", shortlist: input.candidates }),
    schema: RerankSchema,
  });
}
