import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { describeAnswers, leaning, SCALES } from "@/lib/taste/statement";
import type { TasteAnswers } from "@/lib/taste/types";

const TasteSummary = z.object({
  summary: z.string().min(40).max(900),
  dna: z.array(z.string().min(3).max(60)).min(3).max(4),
});

export type SummaryTitle = {
  title: string;
  year: number | null;
  genres: string[];
  vibe: string | null;
  note?: string;
  /** Their own take, from describeReactions: "worked: humour · didn't: too slow · in their words: “…”". */
  reactions?: string | null;
};

export type SummaryInput = {
  answers: TasteAnswers | null;
  loved: SummaryTitle[];
  liked: SummaryTitle[];
  disliked: SummaryTitle[];
  likedGenres: string[];
  dislikedGenres: string[];
  themes: string[];
  vibe: { pace: number; tone: number; complexity: number } | null;
};

const SYSTEM = `You are the taste analyst inside a film and TV discovery app. From a viewer's answers and the titles they loved, liked and disliked, describe their taste.

summary: 2–4 sentences in the second person ("You…"). Specific and warm, never flattering. Name the patterns (sub-genres, moods, storytelling styles, eras) that connect what they love; mention a clear dislike if the evidence shows one. No spoilers, no numbers or ratings, don't mention the app.

dna: 3–4 short phrases, 2–6 words each, sentence case, no full stop, that read like traits. Examples: "Loves cerebral sci-fi", "Drawn to slow-burn tension", "Comes for sharp dialogue", "Not a fan of slapstick". Prefer specific sub-genres, moods and styles over broad genre names. At most one negative phrase, and only if the evidence shows a dislike.

"Their take" lines are the viewer's own words about a title: what worked, what didn't. They are the strongest evidence of why they like what they like; when they repeat across titles (the dialogue, a slow start), make that pattern part of the summary and the DNA.

Never invent preferences the evidence doesn't support. If the evidence is thin, say so gently in the summary and keep the phrases modest.`;

const line = (t: SummaryTitle) =>
  [
    `- ${t.title}${t.year ? ` (${t.year})` : ""} · ${t.genres.join(", ")}${t.note ? ` · ${t.note}` : ""}`,
    t.reactions ? `  Their take: ${t.reactions}` : null,
    t.vibe ? `  ${t.vibe}` : null,
  ]
    .filter(Boolean)
    .join("\n");

export async function generateTasteSummary(input: SummaryInput): Promise<{ summary: string; dna: string[] }> {
  const v = input.vibe;
  const prompt = [
    input.answers ? `Their onboarding answers:\n${describeAnswers(input.answers) || "- (none given)"}` : "They skipped the onboarding questions.",
    input.loved.length ? `Titles they love:\n${input.loved.map(line).join("\n")}` : null,
    input.liked.length ? `Titles they liked:\n${input.liked.map(line).join("\n")}` : null,
    input.disliked.length ? `Titles they disliked or dropped:\n${input.disliked.map(line).join("\n")}` : null,
    input.likedGenres.length ? `Genres they lean toward: ${input.likedGenres.join(", ")}` : null,
    input.dislikedGenres.length ? `Genres they lean away from: ${input.dislikedGenres.join(", ")}` : null,
    input.themes.length ? `Recurring themes and moods in what they like: ${input.themes.join(", ")}` : null,
    v ? `Their preferred feel: pace ${leaning(v.pace, SCALES.pace)}; tone ${leaning(v.tone, SCALES.tone)}; ${leaning(v.complexity, SCALES.complexity)}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await generateJson({
    model: "text",
    system: SYSTEM,
    prompt,
    schema: TasteSummary,
    thinking: "low",
    temperature: 0.6,
    maxOutputTokens: 1024,
    timeoutMs: 25_000,
    rounds: 2,
  });
  return { summary: res.summary.trim(), dna: res.dna.map((p) => p.trim().replace(/[.!]+$/, "")) };
}
