import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";

export type GroupPickInput = {
  title: string;
  year: number | null;
  genres: string[];
  vibe: string | null;
  members: { name: string; match: number | null; leans: string[] }[];
};

const Reason = z.object({ reason: z.string().min(12).max(200) });

const SYSTEM = `You help a small group of friends choose what to watch tonight. A title has been picked because
it has the best combined match for the group. In ONE sentence of at most 24 words, say why it suits this
group, naming people by first name and pointing at what each of them likes. Use only the facts given.
No spoilers, no plot recap, no hype words ("masterpiece", "must-watch"), no emoji, no exclamation marks.`;

/** The deterministic line, used when no model answers in time. */
export function fallbackPickReason(input: GroupPickInput): string {
  const known = input.members.filter((m) => m.match != null) as { name: string; match: number }[];
  if (!known.length) return `${input.title} is the best fit the list has for everyone right now.`;
  const lowest = known.reduce((a, b) => (b.match < a.match ? b : a));
  const highest = known.reduce((a, b) => (b.match > a.match ? b : a));
  if (lowest.match >= 70) return `Everyone’s at ${lowest.match}% or more for ${input.title}: no compromise needed tonight.`;
  if (highest.name === lowest.name) return `${input.title} is the strongest match on the list for ${highest.name}.`;
  return `The best compromise: ${highest.name} is at ${highest.match}%, and even ${lowest.name} sits at ${lowest.match}%.`;
}

export async function groupPickReason(input: GroupPickInput): Promise<{ reason: string; source: "ai" | "fallback" }> {
  try {
    const res = await generateJson({
      model: "fast",
      thinking: "minimal",
      temperature: 0.5,
      timeoutMs: 9000,
      system: SYSTEM,
      prompt: JSON.stringify({
        title: input.title,
        year: input.year,
        genres: input.genres.slice(0, 4),
        feel: input.vibe ?? undefined,
        group: input.members.map((m) => ({ name: m.name, match: m.match == null ? "unknown" : `${m.match}%`, likes: m.leans.slice(0, 3) })),
      }),
      schema: Reason,
    });
    return { reason: res.reason.trim(), source: "ai" };
  } catch (err) {
    console.warn("[group-pick] reason fell back:", err instanceof Error ? err.message.slice(0, 160) : err);
    return { reason: fallbackPickReason(input), source: "fallback" };
  }
}
