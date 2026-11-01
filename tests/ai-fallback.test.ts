import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { extractJson } from "@/lib/ai/json-text";

type GeminiArgs = { model: string; config: { abortSignal?: AbortSignal } };

// Shared, per-test configurable fakes for the providers.
const fake = vi.hoisted(() => ({
  groqKey: "groq-key" as string | undefined,
  openrouterKey: "or-key" as string | undefined,
  gemini: null as unknown as (args: GeminiArgs) => Promise<{ text: string }>,
}));

vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: () => "http://localhost:3000",
    gemini: () => ({
      apiKey: "gemini-test",
      textModel: "g-primary",
      fastModel: "g-fast",
      textFallbacks: ["g-backup"],
      fastFallbacks: [],
      embedModel: "e",
      embedDim: 768,
    }),
    groq: () => ({ apiKey: fake.groqKey, models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"] }),
    openrouter: () => ({ apiKey: fake.openrouterKey, models: ["or-a:free"] }),
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: (args: GeminiArgs) => fake.gemini(args) };
  },
  ThinkingLevel: { MINIMAL: "MINIMAL", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
}));

const Reply = z.object({ score: z.number(), why: z.string() });
const call = { system: "Judge it.", prompt: "Iron Man 3", schema: Reply, timeoutMs: 5000 };

const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

const unavailable = () => Object.assign(new Error("503 UNAVAILABLE: model overloaded"), { status: 503 });
const chat = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const chatError = (status: number, message: string) => new Response(JSON.stringify({ error: { code: status, message } }), { status });
/** A Gemini reply that takes `ms`, and rejects if its request is aborted first. */
const slowGemini = (ms: number, text: string) => (args: GeminiArgs) =>
  new Promise<{ text: string }>((resolve, reject) => {
    const timer = setTimeout(() => resolve({ text }), ms);
    args.config.abortSignal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
    });
  });

let fetchMock: ReturnType<typeof vi.fn>;
const sent = () => fetchMock.mock.calls.map(([url, init]) => ({ url: url as string, body: JSON.parse((init as RequestInit).body as string) }));

async function load() {
  vi.resetModules(); // fresh skip / degrade state per test
  return import("@/lib/ai/gemini");
}

beforeEach(() => {
  fake.groqKey = "groq-key";
  fake.openrouterKey = "or-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractJson", () => {
  it("reads plain, fenced and wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] });
    expect(extractJson('Here you go: {"a":"b"} Hope that helps.')).toEqual({ a: "b" });
    expect(extractJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("ignores brackets inside strings and gives up on broken text", () => {
    expect(extractJson('Sure! {"why":"a } inside [ quotes","n":2} trailing }')).toEqual({ why: "a } inside [ quotes", n: 2 });
    expect(extractJson("no json here")).toBeUndefined();
    expect(extractJson('{"a": ')).toBeUndefined();
  });
});

// Real timers (the hedges are 50–400 ms): generous per-test time so a busy machine can't time them out.
describe("generateJson fallback chain", { timeout: 20_000 }, () => {
  it("uses Gemini when it answers in time, without touching the fallbacks", async () => {
    fake.gemini = async () => ({ text: '{"score":81,"why":"gemini"}' });
    const { generateJson } = await load();
    await expect(generateJson(call)).resolves.toEqual({ score: 81, why: "gemini" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("goes to Groq as soon as every Gemini model fails, with the model's own reasoning setting", async () => {
    const tried: string[] = [];
    fake.gemini = async ({ model }) => {
      tried.push(model);
      throw unavailable();
    };
    fetchMock.mockResolvedValueOnce(chat('{"score":77,"why":"groq"}'));
    const { generateJson } = await load();
    await expect(generateJson({ ...call, rounds: 2 })).resolves.toEqual({ score: 77, why: "groq" });
    expect(tried).toEqual(["g-primary", "g-backup"]);
    const [first] = sent();
    expect(first!.url).toBe(GROQ);
    expect(first!.body).toMatchObject({ model: "openai/gpt-oss-120b", response_format: { type: "json_object" }, reasoning_effort: "low", include_reasoning: false });
    expect(first!.body.max_completion_tokens).toBeGreaterThanOrEqual(1024);
    expect(first!.body.messages[0].content).toContain('"score"'); // the schema rides along
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer groq-key" });
  });

  it("moves to the next Groq model on a rate limit, then to OpenRouter when Groq is out", async () => {
    fake.gemini = async () => {
      throw unavailable();
    };
    fetchMock.mockResolvedValueOnce(chatError(429, "rate limited")).mockResolvedValueOnce(chat('{"score":64,"why":"qwen"}'));
    let mod = await load();
    await expect(mod.generateJson(call)).resolves.toEqual({ score: 64, why: "qwen" });
    expect(sent().map((r) => r.body.model)).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);
    expect(sent()[1]!.body.reasoning_effort).toBe("none");

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(chatError(429, "rate limited"))
      .mockResolvedValueOnce(chatError(429, "rate limited"))
      .mockResolvedValueOnce(chat('```json\n{"score":58,"why":"openrouter"}\n```'));
    mod = await load();
    await expect(mod.generateJson(call)).resolves.toEqual({ score: 58, why: "openrouter" });
    const last = sent().at(-1)!;
    expect(last.url).toBe(OPENROUTER);
    expect(last.body).toMatchObject({ model: "or-a:free", reasoning: { enabled: false } });
  });

  it("starts the fallback in parallel when Gemini is slow, takes the first answer and aborts Gemini", async () => {
    let geminiSignal: AbortSignal | undefined;
    const slow = slowGemini(400, '{"score":90,"why":"gemini, late"}');
    fake.gemini = (args) => {
      geminiSignal = args.config.abortSignal;
      return slow(args);
    };
    fetchMock.mockResolvedValueOnce(chat('{"score":72,"why":"groq, fast"}'));
    const { generateJson } = await load();
    const started = Date.now();
    await expect(generateJson({ ...call, hedgeMs: 50 })).resolves.toEqual({ score: 72, why: "groq, fast" });
    expect(Date.now() - started).toBeLessThan(350);
    expect(geminiSignal?.aborted).toBe(true);
  });

  it("doesn't call the fallback when Gemini answers before the hedge", async () => {
    fake.gemini = slowGemini(20, '{"score":83,"why":"gemini"}');
    const { generateJson } = await load();
    await expect(generateJson({ ...call, hedgeMs: 300 })).resolves.toEqual({ score: 83, why: "gemini" });
    await new Promise((r) => setTimeout(r, 350)); // past the hedge: it must have been cancelled
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes over a Gemini model that just lost a race, so the next call is fast", async () => {
    const tried: string[] = [];
    const slow = slowGemini(400, '{"score":90,"why":"late"}');
    fake.gemini = (args) => {
      tried.push(args.model);
      return slow(args);
    };
    fetchMock.mockResolvedValueOnce(chat('{"score":71,"why":"first"}')).mockResolvedValueOnce(chat('{"score":70,"why":"second"}'));
    const { generateJson } = await load();
    await generateJson({ ...call, hedgeMs: 50 });
    tried.length = 0;
    await expect(generateJson({ ...call, hedgeMs: 50 })).resolves.toEqual({ score: 70, why: "second" });
    expect(tried).toEqual(["g-backup"]); // the primary rests; only the backup (not yet slow) is tried
  });

  it("retries an instant 5xx once on the same model", async () => {
    fake.gemini = async () => {
      throw unavailable();
    };
    fetchMock.mockResolvedValueOnce(chatError(502, "Provider returned error")).mockResolvedValueOnce(chat('{"score":70,"why":"retried"}'));
    const { generateJson } = await load();
    // The retry needs 4 s of budget left; a roomy budget keeps a busy test machine from deciding it.
    await expect(generateJson({ ...call, timeoutMs: 20_000 })).resolves.toEqual({ score: 70, why: "retried" });
    expect(sent().map((r) => r.body.model)).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-120b"]);
  });

  it("feeds schema errors back to the fallback model once", async () => {
    fake.gemini = async () => {
      throw unavailable();
    };
    fetchMock.mockResolvedValueOnce(chat('{"score":"high"}')).mockResolvedValueOnce(chat('{"score":90,"why":"fixed"}'));
    const { generateJson } = await load();
    await expect(generateJson(call)).resolves.toEqual({ score: 90, why: "fixed" });
    expect(sent()[1]!.body.messages[1].content).toContain("did not match the required schema");
  });

  it("rethrows Gemini's error when the whole chain fails, or when no fallback is configured", async () => {
    fake.gemini = async () => {
      throw Object.assign(new Error("400 INVALID_ARGUMENT: bad request"), { status: 400 });
    };
    fetchMock.mockResolvedValue(chatError(503, "provider down"));
    let mod = await load();
    await expect(mod.generateJson(call)).rejects.toThrow(/INVALID_ARGUMENT/);

    fake.groqKey = undefined;
    fake.openrouterKey = undefined;
    fetchMock.mockClear();
    mod = await load();
    await expect(mod.generateJson(call)).rejects.toThrow(/INVALID_ARGUMENT/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
