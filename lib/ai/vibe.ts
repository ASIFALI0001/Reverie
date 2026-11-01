import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { CATEGORY_LABEL } from "@/lib/catalog/category";
import type { TitleCore, TitleKey, Vibe } from "@/lib/catalog/types";

export const VibeItem = z.object({
  key: z.string(),
  vibeSummary: z.string().min(20).max(480),
  pace: z.number().min(0).max(1),
  tone: z.number().min(0).max(1),
  complexity: z.number().min(0).max(1),
  themes: z.array(z.string().min(2).max(40)).min(2).max(6),
  mood: z.array(z.string().min(2).max(24)).min(1).max(4),
});
export const VibeBatch = z.object({ items: z.array(VibeItem) });

const SYSTEM = `You describe films and series for a recommendation engine.
For each title, write a "vibe summary": 2–3 sentences (at most 60 words) about how it FEELS to watch —
pacing, atmosphere, emotional texture, and what kind of viewer it suits. It is not a plot recap, and it
must contain no spoilers or details beyond the given overview.
Then rate, as decimals:
- pace: 0 = slow-burn, 1 = fast and loud
- tone: 0 = light and comforting, 1 = dark and bleak
- complexity: 0 = easy watch, 1 = demanding, makes you think
List 3–6 themes (short lowercase phrases, e.g. "grief", "found family", "man versus machine") and 2–4 mood
adjectives (lowercase). Use the data given and your knowledge of the work. Be specific and honest; avoid
marketing language. Return one item per input key, using the exact key.`;

function describe(t: TitleCore) {
  return {
    key: t.key,
    title: t.title,
    year: t.year,
    kind: CATEGORY_LABEL[t.category],
    genres: t.genres,
    keywords: t.keywords.slice(0, 15),
    tagline: t.tagline || undefined,
    overview: t.overview.slice(0, 900),
    review: t.reviews[0]?.excerpt.slice(0, 280),
  };
}

const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;

/** Vibe for up to ~10 titles in one call (fast model). Titles the model skips are simply absent. */
export async function generateVibes(titles: TitleCore[]): Promise<Map<TitleKey, Vibe>> {
  if (titles.length === 0) return new Map();
  const wanted = new Set(titles.map((t) => t.key));
  const res = await generateJson({
    model: "fast",
    thinking: "minimal",
    // Bulk enrichment can wait out a busy minute rather than fail the batch.
    patient: true,
    temperature: 0.35,
    system: SYSTEM,
    prompt: `Titles:\n${titles.map((t) => JSON.stringify(describe(t))).join("\n")}`,
    schema: VibeBatch,
  });
  const out = new Map<TitleKey, Vibe>();
  for (const item of res.items) {
    if (!wanted.has(item.key as TitleKey)) continue; // ignore anything the model invented
    out.set(item.key as TitleKey, {
      summary: item.vibeSummary.trim(),
      pace: round(item.pace),
      tone: round(item.tone),
      complexity: round(item.complexity),
      themes: [...new Set(item.themes.map((s) => s.trim().toLowerCase()))].slice(0, 6),
      mood: [...new Set(item.mood.map((s) => s.trim().toLowerCase()))].slice(0, 4),
    });
  }
  return out;
}
