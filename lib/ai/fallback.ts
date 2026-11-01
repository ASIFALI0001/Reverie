import "server-only";
import type { z } from "zod";
import { env } from "@/lib/env";
import { extractJson } from "@/lib/ai/json-text";
import { recordAiUsage } from "@/lib/ai/usage";

/**
 * The fallback chain for structured answers when Gemini fails or stalls: Groq first
 * (about a second per answer), then OpenRouter's free models. Both speak the
 * OpenAI chat format; each reply is validated against the caller's Zod schema.
 */

type Provider = "groq" | "openrouter";
export type FallbackTarget = { provider: Provider; model: string };

const ENDPOINT: Record<Provider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

// Per-attempt caps: a healthy Groq model answers in ~1 s and the free OpenRouter ones in 4–12 s,
// so a model that's slower than this is better left for the next one.
const ATTEMPT_CAP_MS: Record<Provider, number> = { groq: 10_000, openrouter: 15_000 };

export type FallbackCall<S extends z.ZodType> = {
  system: string;
  prompt: string;
  schema: S;
  /** JSON Schema for the reply (the same one Gemini is constrained by). */
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  /** Budget for the whole chain. */
  timeoutMs?: number;
  /** Aborts the chain (used when Gemini wins the race). */
  signal?: AbortSignal;
};

export class ProviderError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Every configured fallback model, in order: Groq's, then OpenRouter's. Empty when neither has a key. */
export function fallbackTargets(): FallbackTarget[] {
  const groq = env.groq();
  const openrouter = env.openrouter();
  return [
    ...(groq.apiKey ? groq.models.map((model) => ({ provider: "groq" as const, model })) : []),
    ...(openrouter.apiKey ? openrouter.models.map((model) => ({ provider: "openrouter" as const, model })) : []),
  ];
}

const id = (t: FallbackTarget) => `${t.provider}:${t.model}`;
const brief = (err: unknown) => (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 140);

// A model that errored is skipped for a while, like the Gemini chain does.
const skipUntil = new Map<string, number>();

function skipFor(err: unknown): number {
  if (err instanceof ProviderError) {
    if (err.status === 429) return Math.min(err.retryAfterMs ?? 60_000, 10 * 60_000);
    // Retired model, bad request, out of credit, or a rejected key: nothing will change for a while.
    if ([400, 401, 402, 403, 404].includes(err.status)) return 15 * 60_000;
    return 2 * 60_000;
  }
  return /abort|timed? ?out/i.test(String(err)) ? 3 * 60_000 : 0;
}

/** Walks the chain until a model replies with JSON that validates. Throws when none does in time. */
export async function fallbackJson<S extends z.ZodType>(call: FallbackCall<S>): Promise<{ data: z.infer<S>; target: FallbackTarget }> {
  const targets = fallbackTargets();
  if (targets.length === 0) throw new Error("No fallback provider is configured.");

  const deadline = Date.now() + (call.timeoutMs ?? 30_000);
  const ready = targets.filter((t) => (skipUntil.get(id(t)) ?? 0) <= Date.now());
  // All resting: the one that comes back soonest goes first.
  const order = ready.length ? ready : [...targets].sort((a, b) => (skipUntil.get(id(a)) ?? 0) - (skipUntil.get(id(b)) ?? 0));
  let lastErr: unknown = new Error("No fallback model answered in time.");

  for (const [i, target] of order.entries()) {
    if (call.signal?.aborted) throw call.signal.reason;
    const left = deadline - Date.now();
    if (left < 1500) break;
    const timeoutMs = i < order.length - 1 ? Math.min(ATTEMPT_CAP_MS[target.provider], left) : left;
    try {
      const data = await askWithRetry(target, call, timeoutMs);
      skipUntil.delete(id(target));
      recordAiUsage(target.provider);
      return { data, target };
    } catch (err) {
      if (call.signal?.aborted) throw err; // the race was settled elsewhere
      lastErr = err;
      const ms = skipFor(err);
      if (ms > 0) skipUntil.set(id(target), Date.now() + ms);
      console.warn(`[fallback] ${target.provider} ${target.model} failed (${brief(err)})${i < order.length - 1 ? "; trying the next model" : ""}`);
    }
  }
  throw lastErr;
}

/** Free endpoints sometimes fail instantly with a 5xx; one quick retry on the same model usually lands. */
async function askWithRetry<S extends z.ZodType>(target: FallbackTarget, call: FallbackCall<S>, timeoutMs: number): Promise<z.infer<S>> {
  const started = Date.now();
  try {
    return await ask(target, call, timeoutMs);
  } catch (err) {
    const left = timeoutMs - (Date.now() - started);
    if (!(err instanceof ProviderError) || err.status < 500 || left < 4000 || call.signal?.aborted) throw err;
    await new Promise((r) => setTimeout(r, 400));
    return ask(target, call, left - 400);
  }
}

/**
 * Reasoning off, or as low as the model allows. Measured on Reverie's prompts: with it on,
 * models spent thousands of tokens thinking (12–41 s) and dropped most of a ranked list;
 * with it off or low, Groq answered in 0.5–1.2 s and OpenRouter's free models in 4–12 s, complete.
 */
function modelParams(target: FallbackTarget, maxOutputTokens: number): Record<string, unknown> {
  if (target.provider === "openrouter") return { max_tokens: Math.max(maxOutputTokens, 2048), reasoning: { enabled: false } };
  const params: Record<string, unknown> = { max_completion_tokens: Math.min(Math.max(maxOutputTokens, 1024), 4096) };
  if (/gpt-oss/i.test(target.model)) Object.assign(params, { reasoning_effort: "low", include_reasoning: false });
  else if (/qwen3/i.test(target.model)) params.reasoning_effort = "none";
  return params;
}

type ChatResponse = {
  choices?: { message?: { content?: string | null }; error?: { code?: number | string; message?: string } }[];
  error?: { code?: number | string; message?: string };
};

async function ask<S extends z.ZodType>(target: FallbackTarget, call: FallbackCall<S>, timeoutMs: number): Promise<z.infer<S>> {
  const { system, schema, jsonSchema, temperature = 0.4 } = call;
  const apiKey = target.provider === "groq" ? env.groq().apiKey : env.openrouter().apiKey;
  const signal = call.signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), call.signal]) : AbortSignal.timeout(timeoutMs);
  const instructions = `${system}\n\nReply with one JSON value that matches this JSON Schema, and nothing else (no code fence, no commentary):\n${JSON.stringify(jsonSchema)}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (target.provider === "openrouter") Object.assign(headers, { "HTTP-Referer": env.siteUrl(), "X-Title": "Reverie" });
  let prompt = call.prompt;

  for (let pass = 0; pass < 2; pass++) {
    const res = await fetch(ENDPOINT[target.provider], {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify({
        model: target.model,
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature,
        ...modelParams(target, call.maxOutputTokens ?? 2048),
      }),
    });
    const body = (await res.json().catch(() => null)) as ChatResponse | null;
    const failure = body?.error ?? body?.choices?.[0]?.error;
    if (!res.ok || failure) {
      const status = typeof failure?.code === "number" ? failure.code : res.status;
      const retryAfter = Number(res.headers.get("retry-after"));
      throw new ProviderError(status, `HTTP ${status}: ${failure?.message ?? res.statusText}`, retryAfter > 0 ? retryAfter * 1000 : null);
    }

    const result = schema.safeParse(extractJson(body?.choices?.[0]?.message?.content ?? ""));
    if (result.success) return result.data;
    if (pass === 1) {
      throw new Error(`invalid JSON from ${target.model}: ${result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    prompt = `${call.prompt}\n\nYour previous reply did not match the required schema (${result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}). Reply again with valid JSON only.`;
  }
  throw new Error("unreachable");
}
