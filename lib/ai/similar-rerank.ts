import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";

const Rerank = z.object({
  items: z.array(z.object({ id: z.string(), why: z.string().min(6).max(140) })).min(1).max(30),
});

export type RerankTitle = {
  id: string;
  title: string;
  year: number | null;
  genres: string[];
  vibe: string | null;
  themes: string[];
  mood: string[];
  director: string | null;
};

const SYSTEM = `You are a film and TV curator. Given a source title and a list of candidates, order the candidates by how genuinely similar they are to the source in FEEL: story shape, tone, themes, pacing, what it's like to watch. Shared genre labels alone don't make two titles similar.

Drop weak matches entirely; keep the strong ones (usually 8–14). For each kept candidate write "why": 6–10 words on what it shares with the source, specific and concrete (e.g. "Same dread-soaked creature hunt, with a smaller cast"). No spoilers. Don't start with the candidate's title.`;

const line = (t: RerankTitle) =>
  [
    `[${t.id}] ${t.title}${t.year ? ` (${t.year})` : ""} · ${t.genres.slice(0, 3).join(", ")}${t.director ? ` · ${t.director}` : ""}`,
    t.vibe ? `  ${t.vibe}` : null,
    t.themes.length || t.mood.length ? `  Themes: ${[...t.themes, ...t.mood].slice(0, 7).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

/** Gemini's similarity order over the candidates, with a short "why" each. Unknown ids are dropped. */
export async function rerankSimilar(source: RerankTitle, candidates: RerankTitle[]): Promise<{ id: string; why: string }[]> {
  const res = await generateJson({
    model: "text",
    system: SYSTEM,
    prompt: `Source:\n${line(source)}\n\nCandidates:\n${candidates.map(line).join("\n")}`,
    schema: Rerank,
    thinking: "low",
    temperature: 0.3,
    maxOutputTokens: 4096,
    timeoutMs: 25_000,
    rounds: 2,
  });
  const known = new Set(candidates.map((c) => c.id));
  const seen = new Set<string>();
  const kept: { id: string; why: string }[] = [];
  for (const item of res.items) {
    // Models sometimes echo the id decorated ("[movie:603]", "movie:603 The Matrix"); take the key itself.
    const id = /(movie|tv):\d+/.exec(item.id)?.[0];
    if (!id || !known.has(id) || seen.has(id)) continue;
    seen.add(id);
    kept.push({ id, why: item.why.trim() });
  }
  if (kept.length < res.items.length) {
    console.warn(`[similar] re-rank returned ${res.items.length - kept.length} unknown ids, e.g. ${JSON.stringify(res.items[0]?.id)}`);
  }
  return kept;
}
