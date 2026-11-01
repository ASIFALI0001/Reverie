import "server-only";
import { createHash } from "node:crypto";
import pLimit from "p-limit";
import type { mongo } from "mongoose";
import { fetchDetails } from "@/lib/sources/tmdb";
import { findAnime, animeTagsFromJikan } from "@/lib/sources/jikan";
import { getOmdbRatings } from "@/lib/sources/omdb";
import { normalizeTmdb } from "@/lib/catalog/normalize";
import { posterPalette } from "@/lib/catalog/colors";
import { profileText } from "@/lib/catalog/profile-text";
import { generateVibes } from "@/lib/ai/vibe";
import { embedDocuments, embedModelId } from "@/lib/ai/embed";
import { EMPTY_RATINGS, titlesCol, type TitleDoc } from "@/lib/db/titles";
import { parseTitleKey, type TitleKey } from "@/lib/catalog/types";

export type EnsureOptions = {
  /** AI vibe + embedding (default true). Off = the fast TMDB-only path. */
  enrich?: boolean;
  colors?: boolean;
  jikan?: boolean;
  /** Re-fetch TMDB details older than this many days. */
  maxAgeDays?: number;
  log?: (line: string) => void;
};

const VIBE_BATCH = 10;
const JIKAN_RETRY_DAYS = 30;
const colorLimit = pLimit(6);
const vibeLimit = pLimit(3);

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");
const why = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const quota = /"quotaId":"([^"]+)"/.exec(msg)?.[1];
  return quota ? `${msg.slice(0, 120)} [quota: ${quota}]` : msg.slice(0, 300);
};

function blank(now: Date): Omit<TitleDoc, keyof import("@/lib/catalog/types").TitleCore | "_id" | "detailsFetchedAt" | "updatedAt"> {
  return {
    ratings: { ...EMPTY_RATINGS },
    vibe: null,
    colors: null,
    posterBlur: null,
    jikan: null,
    jikanCheckedAt: null,
    profileText: "",
    profileHash: null,
    embedModel: null,
    enrichedAt: null,
    ratingsUpdatedAt: null,
    createdAt: now,
  };
}

/**
 * Make sure each title exists in `titles` and is reasonably fresh, running only
 * the stages it still needs: TMDB details → poster palette → MAL (anime) →
 * vibe (Gemini) → profile text → embedding (only when the text changed).
 * Any stage can fail without losing the others; the next call fills the gaps.
 */
export async function ensureTitles(keys: TitleKey[], opts: EnsureOptions = {}): Promise<Map<TitleKey, TitleDoc>> {
  const { enrich = true, colors = true, jikan = true, maxAgeDays = 7, log } = opts;
  const col = await titlesCol();
  const wanted = [...new Set(keys)].filter((k) => parseTitleKey(k));
  if (wanted.length === 0) return new Map();

  const existing = await col.find({ _id: { $in: wanted } }, { projection: { embedding: 0 } }).toArray();
  const docs = new Map<TitleKey, TitleDoc>(existing.map((d) => [d._id, d]));
  const dirty = new Set<TitleKey>();
  const embeddings = new Map<TitleKey, number[]>();
  const now = new Date();
  const staleBefore = Date.now() - maxAgeDays * 86_400_000;

  const t0 = Date.now();
  const lap: string[] = [];
  const mark = (label: string, since: number) => lap.push(`${label} ${((Date.now() - since) / 1000).toFixed(1)}s`);

  // 1 · TMDB details for missing or stale titles.
  const needDetails = wanted.filter((k) => {
    const d = docs.get(k);
    return !d || !d.detailsFetchedAt || d.detailsFetchedAt.getTime() < staleBefore;
  });
  await Promise.all(
    needDetails.map(async (key) => {
      const { mediaType, tmdbId } = parseTitleKey(key)!;
      try {
        const core = normalizeTmdb(await fetchDetails(mediaType, tmdbId), mediaType);
        const prev = docs.get(key);
        const base = prev ?? ({ ...blank(now) } as TitleDoc);
        docs.set(key, {
          ...base,
          ...core,
          _id: key,
          ratings: { ...(base.ratings ?? EMPTY_RATINGS), tmdb: core.voteAverage || null, tmdbVotes: core.voteCount || null },
          animeTags: base.jikan ? [...new Set([...core.animeTags, ...animeTagsFromJikan(base.jikan)])] : core.animeTags,
          detailsFetchedAt: now,
          updatedAt: now,
        });
        dirty.add(key);
      } catch (err) {
        log?.(`  ! details ${key}: ${why(err)}`);
      }
    }),
  );

  mark("details", t0);
  const present = wanted.map((k) => docs.get(k)).filter((d): d is TitleDoc => Boolean(d));
  let t = Date.now();

  // 2 · Poster palette (dominant colour, accents, blur placeholder).
  if (colors) {
    await Promise.all(
      present
        .filter((d) => d.posterPath && d.colors?.forPoster !== d.posterPath)
        .map((d) =>
          colorLimit(async () => {
            const p = await posterPalette(d.posterPath);
            if (!p) return;
            d.colors = { dominant: p.dominant, accentDark: p.accentDark, accentLight: p.accentLight, forPoster: d.posterPath! };
            d.posterBlur = p.blur;
            dirty.add(d._id);
          }),
        ),
    );
  }

  mark("colors", t);
  t = Date.now();

  // 3 · MyAnimeList for anime (Jikan is rate-limited, so this runs one at a time).
  if (jikan) {
    for (const d of present) {
      if (d.category !== "anime") continue;
      if (d.jikanCheckedAt && Date.now() - d.jikanCheckedAt.getTime() < JIKAN_RETRY_DAYS * 86_400_000) continue;
      const info = await findAnime({ key: d._id, title: d.title, originalTitle: d.originalTitle, year: d.year, mediaType: d.mediaType });
      if (info === "unavailable") continue; // try again on a later call
      d.jikan = info;
      d.jikanCheckedAt = now;
      if (info) {
        d.ratings = { ...d.ratings, mal: info.score };
        d.animeTags = [...new Set([...d.animeTags, ...animeTagsFromJikan(info)])];
      }
      dirty.add(d._id);
    }
  }

  mark("mal", t);
  t = Date.now();

  if (enrich) {
    // 4 · Vibe, ten titles per Gemini call.
    const needVibe = present.filter((d) => !d.vibe && (d.overview || d.genres.length));
    const batches: TitleDoc[][] = [];
    for (let i = 0; i < needVibe.length; i += VIBE_BATCH) batches.push(needVibe.slice(i, i + VIBE_BATCH));
    await Promise.all(
      batches.map((batch) =>
        vibeLimit(async () => {
          try {
            const vibes = await generateVibes(batch);
            for (const d of batch) {
              const v = vibes.get(d._id);
              if (v) {
                d.vibe = v;
                dirty.add(d._id);
              }
            }
          } catch (err) {
            log?.(`  ! vibe batch (${batch.length}): ${why(err)}`);
          }
        }),
      ),
    );

    mark("vibe", t);
    t = Date.now();

    // 5 · Profile text → embedding, only when the text (or model) changed.
    const model = embedModelId();
    const needEmbedding: { doc: TitleDoc; text: string; hash: string }[] = [];
    for (const d of present) {
      const text = profileText(d, d.vibe);
      const hash = sha1(`${model}\n${text}`);
      if (hash !== d.profileHash) needEmbedding.push({ doc: d, text, hash });
    }
    if (needEmbedding.length) {
      try {
        const vectors = await embedDocuments(needEmbedding.map(({ doc, text }) => ({ title: doc.title, text })));
        needEmbedding.forEach(({ doc, text, hash }, i) => {
          embeddings.set(doc._id, vectors[i]!);
          doc.profileText = text;
          doc.profileHash = hash;
          doc.embedModel = model;
          doc.enrichedAt = now;
          dirty.add(doc._id);
        });
      } catch (err) {
        log?.(`  ! embeddings (${needEmbedding.length}): ${why(err)}`);
      }
    }
  } else {
    for (const d of present) {
      if (!d.profileText) {
        d.profileText = profileText(d, d.vibe);
        dirty.add(d._id);
      }
    }
  }

  mark("embed", t);
  t = Date.now();

  // 6 · Persist. Undefined fields are stripped so existing embeddings are never nulled.
  if (dirty.size) {
    const ops: mongo.AnyBulkWriteOperation<TitleDoc>[] = [...dirty].map((key) => {
      const { _id, createdAt, embedding: _ignored, ...rest } = docs.get(key)!;
      void _ignored;
      const set: Record<string, unknown> = { updatedAt: now };
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) set[k] = v;
      const vector = embeddings.get(key);
      if (vector) set.embedding = vector;
      return { updateOne: { filter: { _id }, update: { $set: set, $setOnInsert: { createdAt: createdAt ?? now } }, upsert: true } };
    });
    await col.bulkWrite(ops, { ordered: false });
  }
  mark("write", t);
  log?.(`  stages: ${lap.join(" · ")}`);
  return docs;
}

/** One title, fully enriched. Null when TMDB doesn't know it. */
export async function ensureTitle(key: TitleKey, opts?: EnsureOptions) {
  return (await ensureTitles([key], opts)).get(key) ?? null;
}

/** IMDb / RT / Metacritic via OMDb, refreshed weekly (OMDb's free tier is 1,000 calls/day). */
export async function refreshRatings(doc: TitleDoc): Promise<TitleDoc> {
  const fresh = doc.ratingsUpdatedAt && Date.now() - doc.ratingsUpdatedAt.getTime() < 7 * 86_400_000;
  if (fresh || !doc.imdbId) return doc;
  const omdb = await getOmdbRatings(doc.imdbId);
  if (!omdb) return doc;
  const ratings = { ...doc.ratings, ...omdb };
  const ratingsUpdatedAt = new Date();
  const col = await titlesCol();
  await col.updateOne({ _id: doc._id }, { $set: { ratings, ratingsUpdatedAt } });
  return { ...doc, ratings, ratingsUpdatedAt };
}
