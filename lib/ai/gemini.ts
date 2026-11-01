import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { fallbackJson, fallbackTargets } from "@/lib/ai/fallback";
import { recordAiUsage } from "@/lib/ai/usage";

let client: GoogleGenAI | null = null;
export function genai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env.gemini().apiKey });
  return client;
}

export type Thinking = "minimal" | "low" | "medium" | "high";
const LEVEL: Record<Thinking, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Zod → the JSON Schema subset Gemini's responseJsonSchema accepts. */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status ?? 0;
  const msg = err instanceof Error ? err.message : String(err);
  return status === 429 || status >= 500 || /RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE|fetch failed|ECONNRESET|timed? ?out|aborted/i.test(msg);
}

/** Gemini 429s carry a RetryInfo delay ("retryDelay": "38s"); honour it when present. */
export function retryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(msg) ?? /retry in (\d+(?:\.\d+)?)\s*s/i.exec(msg);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

const MAX_WAIT_MS = 90_000;

/** A quota that won't reset for a long while (e.g. the free tier's daily cap). Retrying is pointless. */
export class QuotaExhaustedError extends Error {
  constructor(
    public scope: string,
    public quotaId: string,
    public until: Date,
  ) {
    super(`Gemini quota exhausted for ${scope} (${quotaId}) until ${until.toISOString()}`);
    this.name = "QuotaExhaustedError";
  }
}

/** Daily caps announce themselves via quotaId ("…PerDay…") or a retry delay of hours. */
export function longQuota(err: unknown): { quotaId: string; retryAfterMs: number } | null {
  const msg = err instanceof Error ? err.message : String(err);
  const quotaId = /"quotaId"\s*:\s*"([^"]+)"/.exec(msg)?.[1] ?? null;
  const delay = retryDelayMs(err);
  if ((quotaId && /PerDay/i.test(quotaId)) || (delay != null && delay > 15 * 60_000)) {
    return { quotaId: quotaId ?? "long-quota", retryAfterMs: delay ?? 60 * 60_000 };
  }
  return null;
}

// Per-model circuit breaker: once a daily cap is hit, fail fast until it resets.
const blockedUntil = new Map<string, number>();

export function isBlocked(scope: string): Date | null {
  const until = blockedUntil.get(scope);
  return until && until > Date.now() ? new Date(until) : null;
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, retries = 6, scope = "gemini"): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const blocked = isBlocked(scope);
    if (blocked) throw new QuotaExhaustedError(scope, "circuit-open", blocked);
    try {
      return await fn(attempt);
    } catch (err) {
      const long = longQuota(err);
      if (long) {
        const until = Date.now() + long.retryAfterMs;
        blockedUntil.set(scope, until);
        throw new QuotaExhaustedError(scope, long.quotaId, new Date(until));
      }
      if (attempt >= retries || !isRetryable(err)) throw err;
      // Per-minute quotas: wait out the server's stated delay; otherwise back off exponentially.
      const hinted = retryDelayMs(err);
      const backoff = 1000 * 2 ** attempt;
      await sleep(Math.min(MAX_WAIT_MS, (hinted ?? backoff) * (1 + Math.random() * 0.25)));
    }
  }
}

// Overloaded, rate-limited or hanging models are skipped for a while; capacity differs per model.
const degradedUntil = new Map<string, number>();

export function isDegraded(model: string): boolean {
  const until = degradedUntil.get(model);
  return until != null && until > Date.now();
}

/** A retired or unknown model id (404): skip it for the day rather than failing the call. */
function isModelGone(err: unknown): boolean {
  const status = (err as { status?: number })?.status ?? 0;
  return status === 404 || /"code":\s*404|no longer available|is not found/i.test(err instanceof Error ? err.message : String(err));
}

function degrade(model: string, err: unknown) {
  const long = longQuota(err);
  if (long) {
    blockedUntil.set(model, Date.now() + long.retryAfterMs);
    return;
  }
  const status = (err as { status?: number })?.status ?? 0;
  const msg = err instanceof Error ? err.message : String(err);
  const ms = isModelGone(err)
    ? 24 * 3_600_000
    : /abort|timed? ?out|deadline/i.test(msg)
    ? 5 * 60_000 // hanging: don't make the next caller wait it out too
    : status === 429 || /RESOURCE_EXHAUSTED/.test(msg)
      ? Math.min(retryDelayMs(err) ?? 60_000, 10 * 60_000)
      : 2 * 60_000;
  degradedUntil.set(model, Date.now() + ms);
}

/** The models to try for a role, primary first. */
export function modelChain(kind: "text" | "fast"): string[] {
  const g = env.gemini();
  return [...new Set(kind === "fast" ? [g.fastModel, ...g.fastFallbacks] : [g.textModel, ...g.textFallbacks])];
}

type JsonCall<S extends z.ZodType> = {
  model?: "text" | "fast";
  system: string;
  prompt: string;
  schema: S;
  thinking?: Thinking;
  temperature?: number;
  maxOutputTokens?: number;
  /** Per attempt. A model that isn't the last resort gets at most FIRST_TRY_MS before we move on. */
  timeoutMs?: number;
  /** Bulk jobs: when every model is busy, wait and go round again instead of failing. */
  patient?: boolean;
  /** Interactive calls with time to spare: passes over the chain (busy spikes often clear within seconds). */
  rounds?: number;
  /**
   * Interactive calls: if Gemini hasn't answered by then, the fallback chain starts in parallel
   * and the first valid answer wins. Defaults to 30% of timeoutMs, kept within 4–8 s. Bulk calls don't hedge.
   */
  hedgeMs?: number;
};

const FIRST_TRY_MS = 15_000;
// A Gemini model that lost a race to the fallback is passed over for this long, so the next
// calls go straight to the fast path instead of waiting out the hedge again.
const SLOW_SKIP_MS = 60_000;
const brief = (err: unknown) => (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 120);

/** Busy, rate-limited, out of quota or retired: another model, or a later round, may still answer. */
const recoverable = (err: unknown) => err instanceof QuotaExhaustedError || isRetryable(err) || isModelGone(err);

/** The reason a request is aborted when the other side of a race has already answered. */
class RaceSettled extends Error {
  constructor() {
    super("Race settled by the other provider");
    this.name = "RaceSettled";
  }
}

const hedgeFor = (call: JsonCall<z.ZodType>) =>
  call.patient ? Infinity : (call.hedgeMs ?? Math.round(Math.min(8000, Math.max(4000, (call.timeoutMs ?? 20_000) * 0.3))));

/**
 * Structured generation. Gemini first: its reply is constrained by the JSON schema and
 * validated again with Zod. A model that is overloaded, rate-limited or slow hands over to
 * the next in its chain at once. With a fallback configured (Groq, then OpenRouter's free
 * models), it races Gemini: it starts the moment Gemini fails, or once Gemini runs past the
 * hedge, and the first valid answer wins. Callers keep their own deterministic fallbacks for
 * when every provider is down.
 */
export async function generateJson<S extends z.ZodType>(call: JsonCall<S>): Promise<z.infer<S>> {
  const rounds = call.patient ? 4 : (call.rounds ?? 1);
  let lastErr: unknown = new Error("No Gemini model is available right now.");
  let round = 0;

  if (fallbackTargets().length > 0) {
    try {
      return await raceWithFallback(call);
    } catch (err) {
      // Both sides failed. Interactive calls stop here; bulk jobs give Gemini more rounds.
      if (!call.patient || !recoverable(err)) throw err;
      lastErr = err;
      round = 1;
      await sleep(Math.min(MAX_WAIT_MS, retryDelayMs(err) ?? 15_000));
    }
  }

  for (; round < rounds; round++) {
    try {
      return await geminiPass(call, true);
    } catch (err) {
      lastErr = err;
      if (!recoverable(err)) throw err;
    }
    if (round < rounds - 1) {
      await sleep(call.patient ? Math.min(MAX_WAIT_MS, retryDelayMs(lastErr) ?? 15_000 * (round + 1)) : 1500);
    }
  }
  throw lastErr;
}

/** Gemini against the fallback chain; throws Gemini's error when neither answers. */
async function raceWithFallback<S extends z.ZodType>(call: JsonCall<S>): Promise<z.infer<S>> {
  const stopGemini = new AbortController();
  const stopFallback = new AbortController();
  const hedgeMs = hedgeFor(call);

  let startFallback!: (why: string) => void;
  const started = new Promise<string>((resolve) => (startFallback = resolve));
  // Models already known to be failing are skipped: with somewhere else to go, there's no point waiting on them.
  const gemini = geminiPass(call, false, stopGemini.signal);
  gemini.catch((err: unknown) => startFallback(`Gemini couldn't answer (${brief(err)})`));
  const timer = Number.isFinite(hedgeMs) ? setTimeout(() => startFallback(`Gemini is past ${hedgeMs} ms`), hedgeMs) : null;

  const fallback = started.then((why) => {
    console.warn(`[ai] ${why}; asking the fallback chain`);
    return fallbackJson({
      system: call.system,
      prompt: call.prompt,
      schema: call.schema,
      jsonSchema: toGeminiSchema(call.schema),
      temperature: call.temperature,
      maxOutputTokens: call.maxOutputTokens,
      timeoutMs: Math.max(call.timeoutMs ?? 20_000, 15_000),
      signal: stopFallback.signal,
    });
  });

  try {
    const winner = await Promise.any([
      gemini.then((data) => ({ data, by: null })),
      fallback.then(({ data, target }) => ({ data, by: target })),
    ]);
    if (winner.by) {
      stopGemini.abort(new RaceSettled());
      console.info(`[ai] answered by ${winner.by.provider} ${winner.by.model}`);
    } else {
      stopFallback.abort(new RaceSettled());
    }
    return winner.data;
  } catch (err) {
    const [geminiErr, fallbackErr] = (err as AggregateError).errors ?? [err];
    console.warn(`[ai] the fallback chain couldn't answer either (${brief(fallbackErr)})`);
    throw geminiErr;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One pass over the Gemini chain, primary first. */
async function geminiPass<S extends z.ZodType>(call: JsonCall<S>, includeDegraded: boolean, signal?: AbortSignal): Promise<z.infer<S>> {
  const open = modelChain(call.model ?? "text").filter((m) => !isBlocked(m));
  const healthy = open.filter((m) => !isDegraded(m));
  const order = healthy.length || !includeDegraded ? healthy : open;
  if (order.length === 0) throw Object.assign(new Error("Every Gemini model is busy or out of quota right now."), { status: 503 });

  let lastErr: unknown;
  for (const [i, model] of order.entries()) {
    const timeoutMs = i < order.length - 1 ? Math.min(call.timeoutMs ?? 60_000, FIRST_TRY_MS) : (call.timeoutMs ?? 60_000);
    try {
      return await generateWith(model, call, timeoutMs, signal);
    } catch (err) {
      if (signal?.aborted) {
        // Lost the race: slower than the fallback, not necessarily broken.
        degradedUntil.set(model, Math.max(degradedUntil.get(model) ?? 0, Date.now() + SLOW_SKIP_MS));
        throw err;
      }
      lastErr = err;
      if (!recoverable(err)) throw err;
      degrade(model, err);
      console.warn(`[gemini] ${model} unavailable (${brief(err)})${i < order.length - 1 ? "; trying the next model" : ""}`);
    }
  }
  throw lastErr;
}

async function generateWith<S extends z.ZodType>(model: string, call: JsonCall<S>, timeoutMs: number, signal?: AbortSignal): Promise<z.infer<S>> {
  const { system, schema, thinking = "low", temperature = 0.4, maxOutputTokens = 8192 } = call;
  const responseJsonSchema = toGeminiSchema(schema);
  let prompt = call.prompt;
  let thinkingConfig: { thinkingLevel: ThinkingLevel } | undefined = { thinkingLevel: LEVEL[thinking] };

  for (let pass = 0; pass < 3; pass++) {
    let text: string;
    try {
      const res = await genai().models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature,
          maxOutputTokens,
          ...(thinkingConfig ? { thinkingConfig } : {}),
          abortSignal: signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs),
        },
      });
      text = res.text ?? "";
    } catch (err) {
      // Fallback models don't all accept every thinking level; use the model's default instead.
      if (thinkingConfig && /thinking level/i.test(brief(err))) {
        thinkingConfig = undefined;
        continue;
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    const result = schema.safeParse(parsed);
    if (result.success) {
      recordAiUsage("gemini");
      return result.data;
    }
    if (pass === 2 || prompt !== call.prompt) {
      throw new Error(`Gemini returned invalid JSON for ${model}: ${result.error.issues.slice(0, 3).map((i) => i.message).join("; ")}`);
    }
    prompt = `${call.prompt}\n\nYour previous reply did not match the required schema (${result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}). Reply again with valid JSON only.`;
  }
  throw new Error("unreachable");
}
