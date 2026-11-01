import "server-only";
import pLimit from "p-limit";
import { env } from "@/lib/env";
import { genai, withRetry } from "@/lib/ai/gemini";
import { normalize } from "@/lib/reco/vector";

const BATCH = 50;
// Embedding quotas are per minute (tokens + requests): one batch in flight per process
// keeps parallel callers (the seed runs several chunks at once) from bursting past them.
const embedLimit = pLimit(1);
/** No single embedding request may hang the queue: one stalled connection would block every caller. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Interactive callers (onboarding, Ask) wait at most this long, then carry on without a vector. */
export const INTERACTIVE_EMBED_MS = 6000;

type EmbedOptions = { retries?: number; requestTimeoutMs?: number };

/**
 * gemini-embedding-2 takes task prefixes instead of a task type: documents are
 * "title: … | text: …", queries are "task: search result | query: …".
 * Each input is its own Content — passing several strings in one Content would
 * return a single aggregated vector.
 */
async function embed(texts: string[], { retries = 6, requestTimeoutMs = REQUEST_TIMEOUT_MS }: EmbedOptions = {}): Promise<number[][]> {
  const { embedModel, embedDim } = env.gemini();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const res = await embedLimit(() =>
      withRetry(
        () =>
          genai().models.embedContent({
            model: embedModel,
            contents: chunk.map((text) => ({ role: "user", parts: [{ text }] })),
            config: { outputDimensionality: embedDim, abortSignal: AbortSignal.timeout(requestTimeoutMs) },
          }),
        retries,
        embedModel,
      ),
    );
    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== chunk.length || vectors.some((v) => v.length !== embedDim)) {
      throw new Error(`Embedding shape mismatch: got ${vectors.length}×${vectors[0]?.length ?? 0}, expected ${chunk.length}×${embedDim}`);
    }
    out.push(...vectors.map(normalize));
  }
  return out;
}

/** Bulk work (seeding, enrichment) is patient: it waits out per-minute quotas and retries. */
export function embedDocuments(docs: { title: string; text: string }[]): Promise<number[][]> {
  return embed(docs.map((d) => `title: ${d.title || "none"} | text: ${d.text}`));
}

/**
 * A query embedding. With `budgetMs` (someone is waiting: onboarding, Ask), it makes one quick
 * attempt and gives up when the budget runs out, rather than waiting out a busy quota for
 * minutes; every such caller already carries on without the vector.
 */
export async function embedQuery(query: string, { budgetMs }: { budgetMs?: number } = {}): Promise<number[]> {
  const text = `task: search result | query: ${query}`;
  if (!budgetMs) return (await embed([text]))[0]!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Embedding took longer than ${Math.round(budgetMs / 1000)} s`)), budgetMs);
  });
  try {
    const [v] = await Promise.race([embed([text], { retries: 0, requestTimeoutMs: budgetMs }), expired]);
    return v!;
  } finally {
    clearTimeout(timer);
  }
}

export function embedModelId() {
  const { embedModel, embedDim } = env.gemini();
  return `${embedModel}@${embedDim}`;
}
