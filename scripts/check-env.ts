/**
 * Verifies every configured service with a real (cheap) call. Never prints secrets.
 *   npm run check:env
 */
import "./_env";
import { createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import mongoose from "mongoose";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

type Result = { service: string; ok: boolean; detail: string };
const results: Result[] = [];
const env = (k: string) => process.env[k]?.trim() ?? "";

async function check(service: string, fn: () => Promise<string>) {
  try {
    results.push({ service, ok: true, detail: await fn() });
  } catch (e) {
    results.push({ service, ok: false, detail: e instanceof Error ? e.message.split("\n")[0]! : String(e) });
  }
}

const privateKey = () => env("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");

async function main() {
  await check("Firebase admin key (matches Google's published cert)", async () => {
    const key = createPrivateKey(privateKey());
    const email = env("FIREBASE_ADMIN_CLIENT_EMAIL");
    const res = await fetch(`https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(email)}`);
    const certs = (await res.json()) as Record<string, string>;
    const ours = createPublicKey(key).export({ type: "spki", format: "der" }).toString("base64");
    const match = Object.entries(certs).find(
      ([, pem]) => new X509Certificate(pem).publicKey.export({ type: "spki", format: "der" }).toString("base64") === ours,
    );
    if (!match) throw new Error("private key does not match any published cert for this service account");
    return `${key.asymmetricKeyType} key, matches cert ${match[0].slice(0, 8)}…`;
  });

  await check("Firebase Auth (admin)", async () => {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: env("FIREBASE_ADMIN_PROJECT_ID"),
          clientEmail: env("FIREBASE_ADMIN_CLIENT_EMAIL"),
          privateKey: privateKey(),
        }),
      });
    const users = await getAuth(app).listUsers(1);
    return `project ${app.options.credential ? env("FIREBASE_ADMIN_PROJECT_ID") : "?"}, ${users.users.length ? "has users" : "no users yet"}`;
  });

  await check("Firebase sign-in providers", async () => {
    const credential = cert({
      projectId: env("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: env("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: privateKey(),
    });
    const { access_token } = await credential.getAccessToken();
    const project = env("FIREBASE_ADMIN_PROJECT_ID");
    const headers = { Authorization: `Bearer ${access_token}` };
    const cfgRes = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`, { headers });
    if (!cfgRes.ok) throw new Error(`config ${cfgRes.status}: ${(await cfgRes.text()).slice(0, 160)}`);
    const cfg = (await cfgRes.json()) as { signIn?: { email?: { enabled?: boolean } }; authorizedDomains?: string[] };
    const g = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs/google.com`,
      { headers },
    );
    const google = g.ok ? ((await g.json()) as { enabled?: boolean }).enabled === true : false;
    const email = cfg.signIn?.email?.enabled === true;
    const domains = cfg.authorizedDomains ?? [];
    const summary = `email/password ${email ? "ON" : "OFF"}, google ${google ? "ON" : "OFF"}, domains: ${domains.join(", ")}`;
    if (!email || !google) throw new Error(summary);
    return summary;
  });

  await check("MongoDB Atlas", async () => {
    const conn = await mongoose.createConnection(env("MONGODB_URI"), { serverSelectionTimeoutMS: 10_000 }).asPromise();
    const admin = conn.db!.admin();
    await admin.ping();
    const info = await admin.serverInfo();
    const cols = await conn.db!.listCollections().toArray();
    await conn.close();
    return `db "${conn.name}", MongoDB ${info.version}, ${cols.length} collections`;
  });

  await check("TMDB", async () => {
    const res = await fetch("https://api.themoviedb.org/3/movie/68721?append_to_response=external_ids", {
      headers: { Authorization: `Bearer ${env("TMDB_READ_TOKEN")}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const m = (await res.json()) as { title: string; release_date: string; external_ids: { imdb_id: string } };
    return `${m.title} (${m.release_date.slice(0, 4)}) → ${m.external_ids.imdb_id}`;
  });

  await check("OMDb", async () => {
    const res = await fetch(`https://www.omdbapi.com/?i=tt1300854&apikey=${env("OMDB_API_KEY")}`);
    const j = (await res.json()) as { Response: string; Error?: string; imdbRating?: string; Ratings?: { Source: string; Value: string }[] };
    if (j.Response !== "True") throw new Error(j.Error ?? "no response");
    return `IMDb ${j.imdbRating}; ${(j.Ratings ?? []).map((r) => `${r.Source.split(" ")[0]} ${r.Value}`).join(", ")}`;
  });

  await check("Gemini text", async () => {
    const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
    const model = env("GEMINI_TEXT_MODEL");
    const r = await ai.models.generateContent({
      model,
      contents: "Reply with exactly the word: ready",
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, maxOutputTokens: 200 },
    });
    return `${model} → "${(r.text ?? "").trim().slice(0, 40)}"`;
  });

  await check("Gemini fast", async () => {
    const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
    const model = env("GEMINI_FAST_MODEL") || env("GEMINI_TEXT_MODEL");
    const r = await ai.models.generateContent({
      model,
      contents: "Reply with exactly the word: ready",
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, maxOutputTokens: 200 },
    });
    return `${model} → "${(r.text ?? "").trim().slice(0, 40)}"`;
  });

  await check("Gemini embeddings", async () => {
    const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
    const model = env("GEMINI_EMBED_MODEL");
    const dim = Number(env("GEMINI_EMBED_DIM") || 768);
    const r = await ai.models.embedContent({
      model,
      contents: [
        { role: "user", parts: [{ text: "title: Iron Man 3 | text: A billionaire inventor faces a terrorist." }] },
        { role: "user", parts: [{ text: "title: Arrival | text: A linguist decodes an alien language." }] },
      ],
      config: { outputDimensionality: dim },
    });
    const vecs = r.embeddings ?? [];
    const lens = vecs.map((v) => v.values?.length ?? 0);
    const norm = Math.hypot(...(vecs[0]?.values ?? []));
    if (vecs.length !== 2) throw new Error(`expected 2 separate vectors, got ${vecs.length}`);
    if (lens.some((l) => l !== dim)) throw new Error(`expected ${dim} dims, got ${lens.join("/")}`);
    return `${model}: 2 vectors × ${dim} dims, |v|=${norm.toFixed(3)}`;
  });

  await check("YouTube Data API", async () => {
    const key = env("YOUTUBE_API_KEY");
    if (!key) throw new Error("not configured yet (videos fall back to TMDB trailers)");
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return "key works (1 quota unit used)";
  });

  await check("Groq (first fallback)", async () => {
    const key = env("GROQ_API_KEY");
    if (!key) throw new Error("not configured (the fallback goes straight to OpenRouter)");
    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const models = (env("GROQ_MODELS") || "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b").split(",").map((m) => m.trim()).filter(Boolean);
    const list = await fetch("https://api.groq.com/openai/v1/models", { headers });
    if (!list.ok) throw new Error(`key rejected (HTTP ${list.status})`);
    const available = new Set(((await list.json()) as { data: { id: string }[] }).data.map((m) => m.id));
    const missing = models.filter((m) => !available.has(m));
    const started = Date.now();
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: models[0],
        messages: [{ role: "user", content: 'Reply with exactly {"ok":true} as JSON' }],
        response_format: { type: "json_object" },
        max_completion_tokens: 200,
      }),
    });
    if (!res.ok) throw new Error(`${models[0]}: HTTP ${res.status}`);
    return `${models[0]} answered in ${((Date.now() - started) / 1000).toFixed(1)} s${missing.length ? `; not offered any more: ${missing.join(", ")}` : ""}`;
  });

  await check("OpenRouter (fallback when Gemini fails)", async () => {
    const key = env("OPENROUTER_API_KEY");
    if (!key) throw new Error("not configured (when Gemini fails, the app uses its built-in scores)");
    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const info = await fetch("https://openrouter.ai/api/v1/key", { headers });
    if (!info.ok) throw new Error(`key rejected (HTTP ${info.status})`);
    const models = (env("OPENROUTER_MODELS") || "nvidia/nemotron-3.5-super-vl:free,dots-studio/dots-3-note-preview:free")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const failed: string[] = [];
    for (const model of models) {
      const started = Date.now();
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: 'Reply with exactly {"ok":true}' }],
          response_format: { type: "json_object" },
          max_tokens: 50,
          reasoning: { enabled: false },
        }),
      }).catch((e: unknown) => e as Error);
      if (res instanceof Error || !res.ok) {
        failed.push(`${model} (${res instanceof Error ? res.message : `HTTP ${res.status}`})`);
        continue;
      }
      return `${model} answered in ${((Date.now() - started) / 1000).toFixed(1)} s${failed.length ? `; unavailable: ${failed.join(", ")}` : ""}`;
    }
    throw new Error(`no model answered: ${failed.join(", ")}`);
  });

  const width = Math.max(...results.map((r) => r.service.length));
  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.service.padEnd(width)}  ${r.detail}`);
  // YouTube, Groq and OpenRouter are optional: the app degrades without them.
  process.exit(results.some((r) => !r.ok && !/^(YouTube|Groq|OpenRouter)/.test(r.service)) ? 1 : 0);
}

main();
