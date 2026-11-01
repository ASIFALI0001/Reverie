import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ensureTitle, refreshRatings } from "@/lib/catalog/ensure";
import { getCollection } from "@/lib/sources/tmdb";
import { titlesCol, type TitleDoc } from "@/lib/db/titles";
import { titleHref, titleSlug } from "@/lib/catalog/links";
import { titleKey, type MediaType, type TitleKey } from "@/lib/catalog/types";

type Internal =
  | "embedding"
  | "profileText"
  | "profileHash"
  | "detailsFetchedAt"
  | "enrichedAt"
  | "ratingsUpdatedAt"
  | "createdAt"
  | "updatedAt"
  | "jikanCheckedAt"
  | "embedModel"
  | "keywordIds"
  | "genreIds";

export type TitlePageData = Omit<TitleDoc, Internal> & { slug: string };

function toPage(doc: TitleDoc): TitlePageData {
  /* eslint-disable @typescript-eslint/no-unused-vars -- stripping internal fields */
  const {
    embedding,
    profileText,
    profileHash,
    detailsFetchedAt,
    enrichedAt,
    ratingsUpdatedAt,
    createdAt,
    updatedAt,
    jikanCheckedAt,
    embedModel,
    keywordIds,
    genreIds,
    ...rest
  } = doc;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return { ...rest, slug: titleSlug(doc.tmdbId, doc.title) };
}

const ENRICH_BUDGET_MS = 6000;

/**
 * Everything the title page renders, shared by every visitor. A never-seen title
 * gets up to six seconds for its AI enrichment; past that the page renders from
 * TMDB data alone (cached briefly) while enrichment finishes in the background.
 */
export async function getTitlePage(mediaType: MediaType, tmdbId: number): Promise<TitlePageData | null> {
  "use cache";
  cacheTag(`title:${mediaType}:${tmdbId}`);
  const key = titleKey(mediaType, tmdbId);
  let doc = await ensureTitle(key, { enrich: false });
  if (!doc) {
    cacheLife("minutes");
    return null;
  }
  // An embedding without a vibe means the vibe call failed earlier (e.g. rate-limited) — retry it.
  if (!doc.enrichedAt || !doc.vibe) {
    const enriched = ensureTitle(key, { enrich: true }).catch(() => null);
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), ENRICH_BUDGET_MS));
    doc = (await Promise.race([enriched, timeout])) ?? doc;
  }
  // Unenriched pages stay cached only briefly, so the vibe appears once enrichment lands.
  if (doc.enrichedAt && doc.vibe) cacheLife("hours");
  else cacheLife("minutes");
  return toPage(await refreshRatings(doc));
}

export type TimelinePart = {
  key: TitleKey;
  /** Release date for ordering ("9999" when unannounced). */
  sortDate: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  href: string;
  released: boolean;
};

/** A franchise in release order (unreleased parts last). */
export async function getCollectionTimeline(collectionId: number): Promise<{ name: string; parts: TimelinePart[] } | null> {
  "use cache";
  cacheLife("days");
  try {
    const c = await getCollection(collectionId);
    const today = new Date().toISOString().slice(0, 10);
    const parts = c.parts
      .filter((p) => p.title)
      .map((p) => ({
        key: titleKey("movie", p.id),
        title: p.title!,
        year: p.release_date ? Number(p.release_date.slice(0, 4)) : null,
        posterPath: p.poster_path,
        href: titleHref("movie", p.id, p.title!),
        released: Boolean(p.release_date && p.release_date <= today),
        sortDate: p.release_date || "9999",
      }))
      .sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    return { name: c.name.replace(/ Collection$/, ""), parts };
  } catch (err) {
    console.warn(`[timeline] collection ${collectionId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Prerender the most popular titles at build; everything else gets the instant shell. */
export async function popularTitleParams(limit = 40) {
  try {
    const col = await titlesCol();
    const docs = await col
      .find({ enrichedAt: { $ne: null } }, { projection: { mediaType: 1, tmdbId: 1, title: 1 } })
      .sort({ popularity: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({ mediaType: d.mediaType, slug: titleSlug(d.tmdbId, d.title) }));
  } catch {
    return [];
  }
}
