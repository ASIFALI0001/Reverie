import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { describeAnswers } from "@/lib/taste/statement";
import type { TasteAnswers } from "@/lib/taste/types";

const Judgement = z.object({
  llmScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().min(8).max(220)).min(2).max(3),
  watchOut: z.string().min(8).max(240).nullable(),
  becauseYouLiked: z.array(z.string()).max(3),
});
export type Judgement = z.infer<typeof Judgement>;

export type JudgeNeighbour = {
  id: string;
  title: string;
  year: number | null;
  genres: string[];
  /** How the viewer felt, in words: "rated it 9/10", "an all-time favourite", "dropped it"… */
  feeling: string;
  liked: boolean;
  vibe: string | null;
  /** Their own reactions, from describeReactions: "worked: humour · didn't: too slow · in their words: “…”". */
  reactions?: string | null;
};

export type JudgeTarget = {
  id: string;
  title: string;
  year: number | null;
  kind: string;
  genres: string[];
  runtime: string | null;
  credits: string | null;
  overview: string;
  vibe: string | null;
  themes: string[];
  mood: string[];
  critics: string | null;
};

const SYSTEM = `You judge how much ONE specific viewer will enjoy ONE title, using only the evidence given: their taste summary, their answers, and how they felt about the titles they've seen that are most similar to this one.

Be honest and calibrated. A broad but unremarkable fit belongs in the 50s; a poor fit lower; reserve 85+ for titles that line up with several strong signals. Weigh what they actually loved and disliked above general acclaim.

Where they said what worked or didn't for a title they've seen, or described it in their own words, that is the strongest evidence of WHY they liked or disliked it: does this title offer what worked for them, or repeat what didn't? Two people can rate the same film 9/10 for different reasons; follow theirs.

Never spoil anything, in any field: no twists, reveals, deaths, endings or "controversial" plot turns, not even hinted at.

reasons: 2–3 short bullets (at most ~16 words each), second person ("You…"), each grounded in specific evidence: a title they loved and what they loved about it, a theme or mood they favour, a creator, the pace or tone. No numbers or percentages.
watchOut: one honest caveat for THIS viewer about how it feels to watch (a slower first act than they like, a lighter tone, a genre they usually avoid), or null if nothing is worth flagging.
becauseYouLiked: up to 3 ids from the "seen" list that most support your verdict, only ones they liked.
confidence: 0–1, lower when the evidence is thin or contradictory.`;

export function neighbourLine(n: JudgeNeighbour): string {
  return [
    `- [${n.id}] ${n.title}${n.year ? ` (${n.year})` : ""} · ${n.genres.slice(0, 3).join(", ")} · ${n.feeling}`,
    n.reactions ? `  Their take: ${n.reactions}` : null,
    n.vibe ? `  ${n.vibe}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function judgeMatch(input: {
  summary: string | null;
  dna: string[];
  answers: TasteAnswers | null;
  neighbours: JudgeNeighbour[];
  target: JudgeTarget;
}): Promise<Judgement> {
  const t = input.target;
  const prompt = [
    `The viewer's taste:\n${input.summary ?? "(no written summary yet)"}${input.dna.length ? `\nTaste DNA: ${input.dna.join("; ")}` : ""}`,
    input.answers ? `Their answers:\n${describeAnswers(input.answers) || "- (none)"}` : null,
    input.neighbours.length
      ? `Titles they've seen that are most similar to this one:\n${input.neighbours.map(neighbourLine).join("\n")}`
      : "They haven't logged anything similar yet.",
    [
      `The title to judge: [${t.id}] ${t.title}${t.year ? ` (${t.year})` : ""} · ${t.kind} · ${t.genres.join(", ")}${t.runtime ? ` · ${t.runtime}` : ""}`,
      t.credits,
      t.overview ? `Overview: ${t.overview}` : null,
      t.vibe ? `Feel: ${t.vibe}` : null,
      t.themes.length || t.mood.length ? `Themes: ${t.themes.join(", ")}${t.mood.length ? ` · Mood: ${t.mood.join(", ")}` : ""}` : null,
      t.critics ? `Critics: ${t.critics}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await generateJson({
    model: "text",
    system: SYSTEM,
    prompt,
    schema: Judgement,
    thinking: "low",
    temperature: 0.3,
    maxOutputTokens: 1536,
    timeoutMs: 20_000,
    rounds: 2,
  });
  const liked = new Set(input.neighbours.filter((n) => n.liked).map((n) => n.id));
  return {
    llmScore: Math.round(res.llmScore),
    confidence: res.confidence,
    reasons: res.reasons.map((r) => r.trim().replace(/^[-•]\s*/, "")),
    watchOut: res.watchOut?.trim() || null,
    // Only titles we actually showed it, and only ones they liked.
    becauseYouLiked: [...new Set(res.becauseYouLiked)].filter((id) => liked.has(id)).slice(0, 3),
  };
}
