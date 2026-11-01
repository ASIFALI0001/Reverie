import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";

/** The three Gemini steps behind natural-language search (brief §5.5). */

export const MOVIE_GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History",
  "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western",
];
export const TV_GENRES = [
  "Action & Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Kids", "Mystery",
  "Sci-Fi & Fantasy", "War & Politics", "Western",
];

const Understanding = z.object({
  referenceTitles: z
    .array(z.object({ title: z.string().min(1).max(120), year: z.number().int().nullable(), kind: z.enum(["movie", "tv", "any"]) }))
    .max(3),
  mustHave: z.object({
    genres: z.array(z.string()).max(6),
    themes: z.array(z.string()).max(6),
    mood: z.array(z.string()).max(6),
  }),
  avoid: z.array(z.string()).max(6),
  format: z.enum(["movie", "series", "anime", "cartoon", "any"]),
  runtimeMax: z.number().int().min(20).max(400).nullable(),
  yearRange: z.object({ from: z.number().int().nullable(), to: z.number().int().nullable() }).nullable(),
  language: z.string().regex(/^[a-z]{2}$/).nullable(),
  rewrittenQuery: z.string().min(5).max(320),
  chips: z.array(z.string().min(2).max(40)).max(6),
});
export type Understanding = z.infer<typeof Understanding>;

const UNDERSTAND_SYSTEM = `You turn a viewer's free-text request for something to watch into search constraints.

- referenceTitles: titles they name as a reference ("like Jurassic World"), with year if obvious and kind movie/tv/any.
- mustHave.genres: only from these genre names. Films: ${MOVIE_GENRES.join(", ")}. Series: ${TV_GENRES.join(", ")}. Leave empty when the request doesn't imply genres.
- mustHave.themes / mood: short lowercase tags like "survival", "time travel", "tense", "heartwarming".
- avoid: genres or tags they ask to avoid (e.g. "not too long" is runtime, not avoid).
- format: movie, series, anime, cartoon, or any.
- runtimeMax in minutes when they set a length ("not too long" ≈ 120, "short" ≈ 100); yearRange when they mention an era; language as an ISO 639-1 code when they ask for one.
- rewrittenQuery: one rich sentence describing the ideal title, in the style of a synopsis (no title names), for semantic search.
- chips: 2–5 tiny labels summarising your reading, e.g. "like: Jurassic World", "+ horror", "under 2h", "series".`;

export function understandQuery(query: string): Promise<Understanding> {
  return generateJson({
    model: "text",
    system: UNDERSTAND_SYSTEM,
    prompt: `Request: ${query}`,
    schema: Understanding,
    thinking: "low",
    temperature: 0.2,
    maxOutputTokens: 1536,
    timeoutMs: 15_000,
    rounds: 2,
  });
}

export type AskCandidate = {
  id: string;
  title: string;
  year: number | null;
  kind: string;
  genres: string[];
  runtime: string | null;
  vibe: string | null;
  tags: string[];
  /** "TMDB 7.4/10", when enough people have rated it. */
  rating: string | null;
};

const Fit = z.object({
  items: z.array(z.object({ id: z.string(), fit: z.number().min(0).max(100), why: z.string().min(6).max(160) })).min(1).max(30),
});

const FIT_SYSTEM = `You match films and series to a viewer's request. For each candidate, judge how well it fits the REQUEST from 0 to 100, and write "why": one line (8–16 words) on why it fits, concrete, no spoilers, not starting with the title.

Keep 10–15 candidates when that many are plausible; drop only clear mismatches (the wrong format, something they asked to avoid, far from the mood). Between two similar fits, prefer the better-received one. List the best fits first.`;

const candidateLine = (c: AskCandidate) =>
  [
    `[${c.id}] ${c.title}${c.year ? ` (${c.year})` : ""} · ${c.kind} · ${c.genres.slice(0, 3).join(", ")}${c.runtime ? ` · ${c.runtime}` : ""}${c.rating ? ` · ${c.rating}` : ""}`,
    c.vibe ? `  ${c.vibe}` : null,
    c.tags.length ? `  Tags: ${c.tags.slice(0, 7).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

const titleNorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Map the model's ids back to ours. Usually it echoes "movie:348"; under load some
 * models send "348", the title, or "Alien (1979)" instead.
 */
export function idResolver(candidates: AskCandidate[]) {
  const known = new Set(candidates.map((c) => c.id));
  const byNumber = new Map<string, string[]>();
  const byTitle = new Map<string, string>();
  for (const c of candidates) {
    const n = c.id.slice(c.id.indexOf(":") + 1);
    byNumber.set(n, [...(byNumber.get(n) ?? []), c.id]);
    byTitle.set(titleNorm(c.title), c.id);
    if (c.year) byTitle.set(titleNorm(`${c.title} ${c.year}`), c.id);
  }
  return (raw: string): string | null => {
    const key = /(movie|tv):\d+/.exec(raw)?.[0];
    if (key && known.has(key)) return key;
    const number = /^\D*(\d+)\D*$/.exec(raw)?.[1];
    const byNum = number ? byNumber.get(number) : undefined;
    if (byNum?.length === 1) return byNum[0]!;
    return byTitle.get(titleNorm(raw.replace(/^\[[^\]]*\]\s*/, ""))) ?? null;
  };
}

/** Gemini's fit-to-request order, with a one-line why each (unknown ids dropped). */
export async function rankForRequest(query: string, constraints: string, candidates: AskCandidate[]) {
  const res = await generateJson({
    model: "text",
    system: FIT_SYSTEM,
    prompt: `Request: ${query}\nOur reading: ${constraints}\n\nCandidates:\n${candidates.map(candidateLine).join("\n")}`,
    schema: Fit,
    thinking: "low",
    temperature: 0.2,
    maxOutputTokens: 4096,
    timeoutMs: 25_000,
    rounds: 2,
  });
  const resolve = idResolver(candidates);
  const seen = new Set<string>();
  const out: { id: string; fit: number; why: string }[] = [];
  for (const i of res.items) {
    const id = resolve(i.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, fit: Math.round(i.fit), why: i.why.trim() });
  }
  if (out.length < res.items.length) console.warn("[ask] fit ids not understood:", JSON.stringify(res.items.slice(0, 2).map((i) => i.id)));
  return out;
}

const Batch = z.object({ items: z.array(z.object({ id: z.string(), llmScore: z.number().min(0).max(100) })).min(1).max(12) });

const BATCH_SYSTEM = `Estimate how much this ONE viewer will enjoy each title, 0–100, from their taste profile and the titles they loved and disliked. Where a title carries their own take (what worked, what didn't, their words), that says why: favour titles that offer what worked for them and avoid repeating what didn't. Be calibrated: the 50s for an unremarkable fit, lower for poor fits, 85+ only when several strong signals line up. Return every title you were given.`;

/** One call that judges the top results for this viewer (the search equivalent of the detail-page match). */
export async function judgeForViewer(input: {
  summary: string | null;
  dna: string[];
  loved: string[];
  disliked: string[];
  titles: AskCandidate[];
}): Promise<Map<string, number>> {
  const res = await generateJson({
    model: "text",
    system: BATCH_SYSTEM,
    prompt: [
      `Their taste: ${input.summary ?? "(no summary yet)"}`,
      input.dna.length ? `Taste DNA: ${input.dna.join("; ")}` : null,
      input.loved.length ? `Loved: ${input.loved.join(", ")}` : null,
      input.disliked.length ? `Disliked: ${input.disliked.join(", ")}` : null,
      `Titles:\n${input.titles.map(candidateLine).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema: Batch,
    thinking: "low",
    temperature: 0.2,
    maxOutputTokens: 1536,
    timeoutMs: 20_000,
    rounds: 2,
  });
  const resolve = idResolver(input.titles);
  const out = new Map<string, number>();
  for (const i of res.items) {
    const id = resolve(i.id);
    if (id) out.set(id, Math.round(i.llmScore));
  }
  // Nothing recognisable, but exactly one score per title: it answered in the order it was asked.
  if (out.size === 0 && res.items.length === input.titles.length) {
    input.titles.forEach((t, n) => out.set(t.id, Math.round(res.items[n]!.llmScore)));
  }
  if (out.size < res.items.length) console.warn("[ask] judgement ids not understood:", JSON.stringify(res.items.slice(0, 3)));
  return out;
}
