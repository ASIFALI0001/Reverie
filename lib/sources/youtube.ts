import "server-only";
import { env } from "@/lib/env";
import { cached, TTL } from "@/lib/cache/cached";
import { fetchJson } from "@/lib/sources/http";
import { reserveQuota } from "@/lib/sources/quota";
import { groupVideos, parseIsoDuration, type RawVideo, type VibeVideo, type VideoKind } from "@/lib/sources/youtube-classify";

const API = "https://www.googleapis.com/youtube/v3";
const SEARCH_COST = 100;
const VIDEOS_COST = 1;

type SearchResponse = { items: { id: { videoId: string } }[] };
type VideosResponse = {
  items: {
    id: string;
    snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails?: Record<string, { url: string }> };
    contentDetails: { duration: string };
    statistics: { viewCount?: string };
  }[];
};

export type VibeVideos = Record<VideoKind, VibeVideo[]> & { quotaLimited?: boolean };

async function search(key: string, q: string): Promise<string[]> {
  if (!(await reserveQuota("youtube", SEARCH_COST))) return [];
  const url = new URL(`${API}/search`);
  url.search = new URLSearchParams({
    part: "id",
    q,
    type: "video",
    videoEmbeddable: "true",
    safeSearch: "moderate",
    maxResults: "50",
    key,
  }).toString();
  const res = await fetchJson<SearchResponse>("YouTube", url, { retries: 1 });
  return res.items.map((i) => i.id.videoId).filter(Boolean);
}

async function details(key: string, ids: string[]): Promise<RawVideo[]> {
  if (ids.length === 0 || !(await reserveQuota("youtube", VIDEOS_COST))) return [];
  const url = new URL(`${API}/videos`);
  url.search = new URLSearchParams({ part: "snippet,contentDetails,statistics", id: ids.slice(0, 50).join(","), key }).toString();
  const res = await fetchJson<VideosResponse>("YouTube", url, { retries: 1 });
  return res.items.map((v) => ({
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt ?? null,
    durationSec: parseIsoDuration(v.contentDetails.duration),
    views: Number(v.statistics.viewCount ?? 0),
    thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? null,
  }));
}

/**
 * Fan edits, reviews and explainers for a title — one combined search (≈101 quota
 * units), with a single targeted follow-up only for an empty tab and only while
 * the day's budget allows. Null when no key is configured.
 */
export async function getVibeVideos(t: { key: string; title: string; year: number | null }): Promise<VibeVideos | null> {
  const key = env.youtubeKey();
  if (!key) return null;
  try {
    return await cached(`yt:${t.key}`, TTL.youtube, async () => {
      const name = `"${t.title}"`;
      const ids = await search(key, `${name} ${t.year ?? ""} edit | review | explained`);
      let raw = await details(key, ids);
      let groups = groupVideos(raw, t.title, t.year);

      const empty = (Object.keys(groups) as VideoKind[]).filter((k) => groups[k].length === 0);
      if (empty.length === 1) {
        const word = { edit: "edit", review: "review", explained: "ending explained" }[empty[0]!];
        const more = await search(key, `${name} ${t.year ?? ""} ${word}`);
        raw = [...raw, ...(await details(key, more.filter((id) => !ids.includes(id))))];
        groups = groupVideos(raw, t.title, t.year);
      }
      if (raw.length === 0) throw new Error("YouTube budget exhausted for today");
      return groups;
    });
  } catch (err) {
    console.warn("[youtube]", err instanceof Error ? err.message : err);
    return { edit: [], review: [], explained: [], quotaLimited: true };
  }
}
