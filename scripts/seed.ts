/**
 * Build the title knowledge base (RAG corpus): TMDB → normalize → palette →
 * MAL (anime) → vibe → embedding. Resumable: enriched titles are skipped.
 *
 *   npm run seed                      # everything (~4–5k titles)
 *   npm run seed -- --limit=200       # a quick smoke run
 *   npm run seed -- --omdb            # also fetch IMDb/RT/Metacritic (≤950/day)
 *   npm run seed -- --no-jikan --no-colors --chunk=40 --parallel=3 --refresh
 */
import "./_env";
import mongoose from "mongoose";
import { getList, getTrending, type TmdbListItem, type TmdbParams } from "@/lib/sources/tmdb";
import { ensureTitles, refreshRatings } from "@/lib/catalog/ensure";
import { titlesCol } from "@/lib/db/titles";
import { titleKey, type MediaType, type TitleKey } from "@/lib/catalog/types";
import { isBlocked } from "@/lib/ai/gemini";
import { env } from "@/lib/env";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

const LIMIT = Number(opt("limit") ?? Infinity);
const CHUNK = Number(opt("chunk") ?? 40);
/** Chunks in flight at once, so Gemini calls overlap with TMDB and palette work. */
const PARALLEL = Number(opt("parallel") ?? 3);

type Source = { label: string; mediaType: MediaType; path: string; params?: TmdbParams; pages: number; minVotes?: number };

const byVotes = { sort_by: "vote_count.desc" };
const SOURCES: Source[] = [
  { label: "movies · popular", mediaType: "movie", path: "/movie/popular", pages: 40 },
  { label: "movies · top rated", mediaType: "movie", path: "/movie/top_rated", pages: 40 },
  { label: "series · popular", mediaType: "tv", path: "/tv/popular", pages: 25 },
  { label: "series · top rated", mediaType: "tv", path: "/tv/top_rated", pages: 25 },
  { label: "anime · series", mediaType: "tv", path: "/discover/tv", params: { with_genres: 16, with_original_language: "ja", ...byVotes }, pages: 15 },
  { label: "anime · films", mediaType: "movie", path: "/discover/movie", params: { with_genres: 16, with_original_language: "ja", ...byVotes }, pages: 5 },
  { label: "cartoons · films", mediaType: "movie", path: "/discover/movie", params: { with_genres: 16, with_original_language: "en", ...byVotes }, pages: 8 },
  { label: "cartoons · series", mediaType: "tv", path: "/discover/tv", params: { with_genres: 16, with_original_language: "en", ...byVotes }, pages: 8 },
  ...(["hi", "ta", "te", "ml", "kn"] as const).map<Source>((lang) => ({
    label: `indian · ${lang}`,
    mediaType: "movie",
    path: "/discover/movie",
    params: { with_original_language: lang, "vote_count.gte": 40, ...byVotes },
    pages: lang === "hi" ? 10 : 6,
  })),
  { label: "indian · series", mediaType: "tv", path: "/discover/tv", params: { with_origin_country: "IN", ...byVotes }, pages: 4 },
  { label: "korean · series", mediaType: "tv", path: "/discover/tv", params: { with_original_language: "ko", ...byVotes }, pages: 4 },
  { label: "korean · films", mediaType: "movie", path: "/discover/movie", params: { with_original_language: "ko", ...byVotes }, pages: 3 },
  ...(["fr", "es", "ja", "de", "it", "zh"] as const).map<Source>((lang) => ({
    label: `world · ${lang}`,
    mediaType: "movie",
    path: "/discover/movie",
    params: { with_original_language: lang, without_genres: 16, ...byVotes },
    pages: 2,
  })),
];

const keep = (r: TmdbListItem, minVotes = 40) => !r.adult && Boolean(r.poster_path) && (r.vote_count ?? 0) >= minVotes;

async function gatherCandidates(): Promise<TitleKey[]> {
  const seen = new Set<TitleKey>();
  const add = (k: TitleKey) => seen.add(k);

  for (let page = 1; page <= 5; page++) {
    const t = await getTrending("all", "week", page);
    for (const r of t.results) if ((r.media_type === "movie" || r.media_type === "tv") && keep(r, 0)) add(titleKey(r.media_type, r.id));
  }
  for (const s of SOURCES) {
    const before = seen.size;
    for (let page = 1; page <= s.pages; page++) {
      try {
        const res = await getList(s.path, { ...s.params, page });
        for (const r of res.results) if (keep(r, s.minVotes)) add(titleKey(s.mediaType, r.id));
        if (page >= res.total_pages) break;
      } catch (err) {
        console.warn(`  ! ${s.label} p${page}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`  ${s.label.padEnd(20)} +${seen.size - before}`);
  }
  return [...seen];
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}s`;

async function main() {
  console.log("Gathering candidates from TMDB…");
  const candidates = (await gatherCandidates()).slice(0, LIMIT);
  const col = await titlesCol();
  const done = new Set(
    flag("refresh")
      ? []
      : (await col.find({ _id: { $in: candidates }, enrichedAt: { $ne: null }, vibe: { $ne: null } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id),
  );
  const todo = candidates.filter((k) => !done.has(k));
  console.log(`\n${candidates.length} candidates · ${done.size} already complete · ${todo.length} to process\n`);

  const started = Date.now();
  let processed = 0;
  const chunks: TitleKey[][] = [];
  for (let i = 0; i < todo.length; i += CHUNK) chunks.push(todo.slice(i, i + CHUNK));
  const runChunk = async (chunk: TitleKey[]) => {
    const docs = await ensureTitles(chunk, {
      enrich: true,
      colors: !flag("no-colors"),
      jikan: !flag("no-jikan"),
      maxAgeDays: flag("refresh") ? 0 : 7,
      log: (l) => console.log(l),
    });
    if (flag("omdb")) {
      for (const d of docs.values()) await refreshRatings(d);
    }
    processed += chunk.length;
    const elapsed = Date.now() - started;
    const eta = (elapsed / processed) * (todo.length - processed);
    const enriched = [...docs.values()].filter((d) => d.enrichedAt).length;
    console.log(`[${processed}/${todo.length}] chunk ok ${enriched}/${chunk.length} enriched · ${fmt(elapsed)} elapsed · ETA ${fmt(eta)}`);
  };
  const queue = [...chunks];
  await Promise.all(
    Array.from({ length: Math.max(1, PARALLEL) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) await runChunk(c);
    }),
  );

  const summary = await col
    .aggregate<{ _id: string; total: number; enriched: number }>([
      { $group: { _id: "$category", total: { $sum: 1 }, enriched: { $sum: { $cond: [{ $ne: ["$enrichedAt", null] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ])
    .toArray();
  console.log("\nCatalog:");
  for (const s of summary) console.log(`  ${String(s._id).padEnd(8)} ${String(s.total).padStart(5)} titles · ${s.enriched} enriched`);

  const g = env.gemini();
  for (const model of [g.embedModel, g.fastModel]) {
    const until = isBlocked(model);
    if (!until) continue;
    console.log(`\n⚠ ${model} hit a daily quota (the Gemini free tier allows 1,000 embedding requests a day).`);
    console.log(`  It resets around ${until.toLocaleString()}. Run "npm run seed" again then; it resumes where it stopped.`);
    console.log("  Or enable billing in Google AI Studio to remove the cap (embedding the rest costs well under $1).");
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
