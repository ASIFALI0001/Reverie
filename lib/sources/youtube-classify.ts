/** Pure helpers for the "Watch the vibe" section (unit-tested; no IO). */
import { foldDiacritics } from "@/lib/format";

export type VideoKind = "edit" | "review" | "explained";

export type RawVideo = {
  id: string;
  title: string;
  channel: string;
  publishedAt: string | null;
  durationSec: number;
  views: number;
  thumbnail: string | null;
};

export type VibeVideo = RawVideo & { kind: VideoKind };

/** ISO-8601 duration ("PT1H2M3S") → seconds. */
export function parseIsoDuration(iso: string | undefined): number {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return (d ?? 0) * 86400 + (h ?? 0) * 3600 + (min ?? 0) * 60 + (s ?? 0);
}

export function normalizeTitle(s: string) {
  return foldDiacritics(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const EDIT = /\b(edits?|amv|fmv|tribute|fan ?made|4k edit|velocity|scene ?pack)\b/i;
const EXPLAINED = /\b(explained|explanation|ending|breakdown|analysis|video essay|essay|theor(y|ies)|easter eggs?|lore)\b/i;
const REVIEW = /\b(review(ed)?|critique|reaction|is it worth|spoiler[- ]free|non[- ]spoiler|thoughts on)\b/i;
const NOISE = /\b(full movie|free movie|watch online|download|hindi dubbed full|official audio|lyrics?)\b/i;

/** Which tab a video belongs in, or null when it fits none (or looks like piracy bait). */
export function classifyVideo(v: RawVideo): VideoKind | null {
  if (NOISE.test(v.title)) return null;
  if (EXPLAINED.test(v.title)) return "explained";
  if (REVIEW.test(v.title)) return "review";
  if (EDIT.test(v.title) && v.durationSec > 0 && v.durationSec <= 600) return "edit";
  return null;
}

/**
 * The video must actually be about this title: its title contains the film's
 * name as whole words. Short names ("Up", "It") also need the year or a
 * film/series word nearby, so we don't match every video using the word.
 */
export function isAbout(videoTitle: string, title: string, year: number | null): boolean {
  const vt = ` ${normalizeTitle(videoTitle)} `;
  const name = normalizeTitle(title);
  if (!name || !vt.includes(` ${name} `)) return false;
  if (name.replace(/ /g, "").length >= 5) return true;
  return (year != null && vt.includes(` ${year} `)) || /\b(movie|film|series|season|show|anime)\b/.test(vt);
}

export function groupVideos(raw: RawVideo[], title: string, year: number | null, perKind = 8) {
  const groups: Record<VideoKind, VibeVideo[]> = { edit: [], review: [], explained: [] };
  const seen = new Set<string>();
  for (const v of [...raw].sort((a, b) => b.views - a.views)) {
    if (seen.has(v.id) || !isAbout(v.title, title, year)) continue;
    const kind = classifyVideo(v);
    if (!kind || groups[kind].length >= perKind) continue;
    seen.add(v.id);
    groups[kind].push({ ...v, kind });
  }
  return groups;
}
