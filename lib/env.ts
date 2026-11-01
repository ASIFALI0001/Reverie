import "server-only";

/**
 * Server-side configuration, read lazily so a missing key only breaks the
 * feature that needs it (and the error says exactly what to add).
 */
function read(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function need(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`Missing ${name}. Add it to .env.local (see .env.example).`);
  return v;
}

/** A comma-separated list, in order. */
function list(name: string, fallback: string): string[] {
  return (read(name) ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  siteUrl: () => read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  /** Where blocked users can appeal (shown on /blocked when set). */
  supportEmail: () => read("SUPPORT_EMAIL") ?? null,
  defaultRegion: () => (read("DEFAULT_REGION") ?? "IN").toUpperCase(),
  /**
   * Key for the opaque handles that stand in for Taste Twins (so no user id reaches the browser).
   * Any long random string; falls back to the Firebase admin key, which is always set and server-only.
   */
  twinSecret: () => read("TWIN_TOKEN_SECRET") ?? need("FIREBASE_ADMIN_PRIVATE_KEY"),
  mongoUri: () => need("MONGODB_URI"),
  tmdb: () => {
    const token = read("TMDB_READ_TOKEN");
    const key = read("TMDB_API_KEY");
    if (!token && !key) throw new Error("Missing TMDB_READ_TOKEN (or TMDB_API_KEY). Add it to .env.local.");
    return { token, key };
  },
  omdbKey: () => read("OMDB_API_KEY"),
  youtubeKey: () => read("YOUTUBE_API_KEY"),
  gemini: () => ({
    apiKey: need("GEMINI_API_KEY"),
    textModel: read("GEMINI_TEXT_MODEL") ?? "gemini-3.6-flash",
    fastModel: read("GEMINI_FAST_MODEL") ?? "gemini-3.5-flash-lite",
    // Tried in order when a model is overloaded, rate-limited or hanging (free-tier capacity varies by model).
    textFallbacks: list("GEMINI_TEXT_FALLBACKS", "gemini-3-flash-preview,gemini-3.5-flash-lite"),
    fastFallbacks: list("GEMINI_FAST_FALLBACKS", "gemini-flash-lite-latest,gemini-3-flash-preview"),
    embedModel: read("GEMINI_EMBED_MODEL") ?? "gemini-embedding-2",
    embedDim: Number(read("GEMINI_EMBED_DIM") ?? 768),
  }),
  /** First fallback for structured answers when Gemini fails or stalls. Off without a key. */
  groq: () => ({
    apiKey: read("GROQ_API_KEY"),
    // Tried in order; each model has its own free-tier limits.
    models: list("GROQ_MODELS", "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b"),
  }),
  /** Second fallback, after Groq. Off without a key. */
  openrouter: () => ({
    apiKey: read("OPENROUTER_API_KEY"),
    // Free models by default, tried in order.
    models: list(
      "OPENROUTER_MODELS",
      "nvidia/nemotron-3.5-super-vl:free,dots-studio/dots-3-note-preview:free,nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3-ultra-550b-a55b:free",
    ),
  }),
  firebaseAdmin: () => ({
    projectId: need("FIREBASE_ADMIN_PROJECT_ID"),
    clientEmail: need("FIREBASE_ADMIN_CLIENT_EMAIL"),
    // Accept both a real multi-line PEM and the single-line "\n"-escaped form most hosts use.
    privateKey: need("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
};
