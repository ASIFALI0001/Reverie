import { formatRuntime } from "@/lib/format";
import type { Affinity } from "@/lib/reco/affinity";

/**
 * "Why it might not be for you": the facts behind a low match (pure, unit-tested).
 * Two kinds of evidence, both from the viewer's own history:
 *   - titles they disliked, dropped or rated low that sit close to this one;
 *   - feature mismatches: longer than the films they finish, a pace, tone or depth far from
 *     theirs, genres they rate low, an era they rarely watch, subtitles they'd rather avoid.
 * Each mismatch is a plain sentence the model may use, and that the fallback uses directly.
 */

export type Vibe3 = { pace: number; tone: number; complexity: number };

export type MismatchKind = "runtime" | "pace" | "tone" | "complexity" | "genre" | "era" | "language";
export type Mismatch = { kind: MismatchKind; fact: string; strength: number };

export type MismatchInput = {
  target: {
    mediaType: "movie" | "tv";
    runtime: number | null;
    genres: string[];
    year: number | null;
    language: string | null;
    vibe: Vibe3 | null;
  };
  /** The viewer's preferred vibe (from their profile), if known. */
  vibe: Vibe3 | null;
  genreAffinity: Affinity[];
  /** Median runtime (minutes) of the films they finished and liked. */
  usualRuntime: number | null;
  /** Mean release year of what they watch. */
  meanYear: number | null;
  /** They said they'd rather not read subtitles. */
  avoidsSubtitles: boolean;
  /** Languages they're happy to watch in (ISO 639-1). */
  languages: string[];
  now?: Date;
};

const LANGUAGE = new Intl.DisplayNames(["en"], { type: "language" });
const languageName = (code: string) => {
  try {
    return LANGUAGE.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Lowercase genre names the way people say them. */
const GENRE_WORDS: Record<string, string> = {
  "Science Fiction": "science fiction",
  "Sci-Fi & Fantasy": "sci-fi and fantasy",
  "Action & Adventure": "action and adventure",
  "War & Politics": "war stories",
  "TV Movie": "TV movies",
};
const genreWord = (g: string) => GENRE_WORDS[g] ?? g.toLowerCase();

export function mismatches(input: MismatchInput): Mismatch[] {
  const { target: t, vibe } = input;
  const out: Mismatch[] = [];

  // Runtime: a film well past the length of the films they finish.
  if (t.mediaType === "movie" && t.runtime && input.usualRuntime && t.runtime >= 125 && t.runtime - input.usualRuntime >= 30) {
    out.push({
      kind: "runtime",
      fact: `It runs ${formatRuntime(t.runtime)}; the films you finish usually run about ${formatRuntime(Math.round(input.usualRuntime / 5) * 5)}.`,
      strength: Math.min(1, (t.runtime - input.usualRuntime) / 60),
    });
  }

  // Pace, tone and depth: only clear distances (0.3+ on the 0–1 scales) count.
  if (vibe && t.vibe) {
    const pace = t.vibe.pace - vibe.pace;
    if (Math.abs(pace) >= 0.3) {
      out.push({
        kind: "pace",
        fact: pace < 0 ? "It’s a slow burn, and you lean toward faster-moving stories." : "It’s fast and loud, and you usually prefer a slower build.",
        strength: Math.abs(pace),
      });
    }
    const tone = t.vibe.tone - vibe.tone;
    if (Math.abs(tone) >= 0.3) {
      out.push({
        kind: "tone",
        fact: tone > 0 ? "It’s dark and heavy, and you usually go for lighter stories." : "It’s light and breezy, and you tend to like darker stories.",
        strength: Math.abs(tone),
      });
    }
    const depth = t.vibe.complexity - vibe.complexity;
    if (Math.abs(depth) >= 0.3) {
      out.push({
        kind: "complexity",
        fact: depth > 0 ? "It asks a lot of you, and you usually like an easier watch." : "It’s a simple, easy watch, and you usually like something to chew on.",
        strength: Math.abs(depth),
      });
    }
  }

  // Genres they rate low (affinity is −1…1; −0.15 and below is a real push away).
  const byTerm = new Map(input.genreAffinity.map((a) => [a.term, a]));
  const low = t.genres.flatMap((g) => {
    const a = byTerm.get(g);
    return a && a.value <= -0.15 && a.n >= 2 ? [{ g, v: a.value }] : [];
  });
  if (low.length) {
    const worst = low.sort((a, b) => a.v - b.v)[0]!;
    out.push({ kind: "genre", fact: `You usually rate ${genreWord(worst.g)} lower than most things you watch.`, strength: Math.min(1, -worst.v) });
  }

  // Era: much older than what they usually watch.
  if (t.year && input.meanYear && input.meanYear - t.year >= 25) {
    out.push({ kind: "era", fact: `It’s from ${t.year}, and most of what you watch is far more recent.`, strength: Math.min(1, (input.meanYear - t.year) / 50) });
  }

  // Subtitles: they said they'd rather not, and it's in a language they don't list.
  const known = new Set(["en", ...input.languages]);
  if (input.avoidsSubtitles && t.language && !known.has(t.language)) {
    out.push({ kind: "language", fact: `It’s in ${languageName(t.language)}, and you said you’d rather not read subtitles.`, strength: 0.7 });
  }

  return out.sort((a, b) => b.strength - a.strength);
}

/** Median of a list (null when empty). */
export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** A title from their history near this one. `feeling` is prompt text; `rating` is for sentences shown to them. */
export type EvidenceTitle = { key: string; title: string; feeling: string; liked: boolean; dropped: boolean; rating: number | null };
export type WhyNotReason = { reason: string; evidence: string[] };
export type WhyNotDraft = { negatives: WhyNotReason[]; positive: string | null };

const MAX_WORDS = 18;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Trim a reason to the word limit at a natural break, and make sure it ends cleanly. */
export function tidyReason(s: string): string {
  const clean = s.trim().replace(/\s+/g, " ");
  if (words(clean) <= MAX_WORDS) return clean;
  const cut = clean.split(" ").slice(0, MAX_WORDS).join(" ").replace(/[,;:—–-]+$/, "");
  return `${cut}…`;
}

/**
 * Keep only what the evidence supports: reasons cite ids from the list we gave, never more
 * than three reasons, each within the word limit. Reasons left empty are dropped.
 */
export function sanitizeWhyNot(draft: WhyNotDraft, allowed: Set<string>): WhyNotDraft {
  const negatives = draft.negatives
    .map((n) => ({ reason: tidyReason(n.reason), evidence: [...new Set(n.evidence.filter((id) => allowed.has(id)))].slice(0, 3) }))
    .filter((n) => n.reason.length >= 8)
    .slice(0, 3);
  const positive = draft.positive?.trim() ? tidyReason(draft.positive) : null;
  return { negatives, positive };
}

const list = (titles: string[]) => (titles.length <= 1 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} or ${titles[titles.length - 1]}`);

/**
 * Without the model: lead with the closest titles they didn't enjoy, then the strongest
 * mismatches. The positive point comes from the closest title they did like.
 */
export function fallbackWhyNot(facts: Mismatch[], near: EvidenceTitle[]): WhyNotDraft {
  const negatives: WhyNotReason[] = [];
  const disliked = near.filter((n) => !n.liked).slice(0, 2);
  if (disliked.length) {
    const dropped = disliked.filter((d) => d.dropped);
    const reason =
      dropped.length === disliked.length
        ? `You dropped ${list(disliked.map((d) => d.title))}, and this one is a lot like ${disliked.length > 1 ? "them" : "it"}.`
        : `You weren’t keen on ${list(disliked.map((d) => d.title))}, and this one is close to ${disliked.length > 1 ? "both" : "it"}.`;
    negatives.push({ reason, evidence: disliked.map((d) => d.key) });
  }
  for (const f of facts) {
    if (negatives.length >= 3) break;
    negatives.push({ reason: f.fact, evidence: [] });
  }
  const liked = near.find((n) => n.liked);
  return {
    negatives: negatives.map((n) => ({ ...n, reason: tidyReason(n.reason) })),
    positive: liked ? tidyReason(`It shares a fair bit with ${liked.title}, ${liked.rating ? `which you rated ${liked.rating}/10` : "one you liked"}.`) : null,
  };
}
