/**
 * "Should I keep going?" maths (pure, unit-tested): where the ratings go after the viewer's
 * episode, and a spoiler check on what the model writes.
 */

export type Ep = { season: number; episode: number; rating: number | null; votes: number };
export type Position = { season: number; episode: number };

/** Episodes with too few votes say little about quality. */
export const MIN_VOTES = 5;

const at = (e: Position) => e.season * 1000 + e.episode;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);

export type Trend = {
  /** Mean rating of the episodes they've seen. */
  watchedAvg: number | null;
  /** Mean rating of the next stretch (up to 10 episodes). */
  nextAvg: number | null;
  /** nextAvg − watchedAvg. */
  delta: number | null;
  /** The rest of the series. */
  restAvg: number | null;
  /** The best-rated episodes still ahead (positions only: no titles). */
  peaksAhead: Position[];
  /** Where a 3-episode stretch first clearly beats what they've seen (+0.3): "give it till". */
  pickup: Position | null;
  /** About three episodes on: a fair "give it till" when nothing clearly picks up. */
  soon: Position | null;
  episodesAhead: number;
};

export function ratingTrend(eps: Ep[], pos: Position, nextWindow = 10): Trend {
  const rated = eps.filter((e) => e.rating != null && e.votes >= MIN_VOTES).sort((a, b) => at(a) - at(b));
  const seen = rated.filter((e) => at(e) <= at(pos));
  const ahead = rated.filter((e) => at(e) > at(pos));
  const watchedAvg = mean(seen.map((e) => e.rating!));
  const next = ahead.slice(0, nextWindow);
  const nextAvg = mean(next.map((e) => e.rating!));
  const restAvg = mean(ahead.map((e) => e.rating!));

  let pickup: Position | null = null;
  if (watchedAvg != null) {
    for (let i = 0; i + 2 < ahead.length && i < 24; i++) {
      const w = mean(ahead.slice(i, i + 3).map((e) => e.rating!))!;
      if (w >= watchedAvg + 0.3) {
        const end = ahead[i + 2]!;
        pickup = { season: end.season, episode: end.episode };
        break;
      }
    }
  }
  const peaksAhead = [...ahead]
    .sort((a, b) => b.rating! - a.rating! || at(a) - at(b))
    .slice(0, 3)
    .map((e) => ({ season: e.season, episode: e.episode }));

  return {
    watchedAvg: round1(watchedAvg),
    nextAvg: round1(nextAvg),
    delta: watchedAvg != null && nextAvg != null ? round1(nextAvg - watchedAvg) : null,
    restAvg: round1(restAvg),
    peaksAhead,
    pickup,
    soon: (() => {
      const all = eps.filter((e) => at(e) > at(pos)).sort((a, b) => at(a) - at(b));
      const e = all[Math.min(2, all.length - 1)];
      return e ? { season: e.season, episode: e.episode } : null;
    })(),
    episodesAhead: eps.filter((e) => at(e) > at(pos)).length,
  };
}

export type SeasonBar = { season: number; avg: number | null; episodes: { episode: number; rating: number | null }[] };

/** Season-by-season ratings for the chart (episodes with too few votes show as gaps). */
export function seasonChart(eps: Ep[]): SeasonBar[] {
  const seasons = [...new Set(eps.map((e) => e.season))].sort((a, b) => a - b);
  return seasons.map((s) => {
    const list = eps.filter((e) => e.season === s).sort((a, b) => a.episode - b.episode);
    const ok = list.filter((e) => e.rating != null && e.votes >= MIN_VOTES);
    return {
      season: s,
      avg: round1(mean(ok.map((e) => e.rating!))),
      episodes: list.map((e) => ({ episode: e.episode, rating: e.rating != null && e.votes >= MIN_VOTES ? Math.round(e.rating * 10) / 10 : null })),
    };
  });
}

// ── Spoiler check ───────────────────────────────────────────────────────────

/** Words that describe events, not pace or quality. A reason that uses them is rejected. */
const EVENT_WORDS =
  /\b(dies|died|death|deaths|dead|killed|kills|killing|murder(?:ed|s)?|twist|twists|reveal(?:s|ed)?|revelation|betray(?:s|ed|al)?|turns out|secret(?:ly)?|pregnan\w*|marr(?:y|ies|ied)|wedding|break(?:s)? up|kiss(?:es|ed)?|returns from|resurrect\w*|identity of|is actually|cliffhanger|ending|finale)\b/i;

const NAME = /\b([A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+)*)\b/g;
const COMMON = new Set([
  "The", "A", "An", "It", "Its", "This", "That", "These", "Those", "You", "Your", "Season", "Episode", "Episodes", "Seasons", "If", "But", "And", "So", "Later",
  "After", "Before", "From", "By", "In", "On", "As", "At", "With", "Once", "When", "Keep", "Give", "Probably", "Stop", "Ratings", "Its", "Things", "Most", "Some",
]);

/** Capitalised names in a text (people, places, groups), first words of sentences included. */
export function namesIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(NAME)) {
    const name = m[1]!;
    if (!COMMON.has(name) && name.length >= 3) out.add(name);
  }
  return out;
}

/**
 * A reason is unsafe if it names someone or something that only appears after their episode
 * (in later overviews, not in what they've seen or the series blurb), or if it talks about events.
 */
export function spoilerProblems(reasons: string[], context: { known: string; later: string }): string[] {
  const known = namesIn(context.known);
  const lower = context.known.toLowerCase();
  const laterOnly = [...namesIn(context.later)].filter((n) => !known.has(n) && !lower.includes(n.toLowerCase()));
  const problems: string[] = [];
  for (const r of reasons) {
    const hit = laterOnly.find((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(r));
    if (hit) problems.push(`names “${hit}”, who only appears later`);
    else if (EVENT_WORDS.test(r)) problems.push(`talks about events (“${r.match(EVENT_WORDS)![0]}”)`);
  }
  return problems;
}

export type Verdict = "keep" | "try" | "stop";

/**
 * The plain verdict from the numbers, for when the model is unavailable or keeps tripping the
 * spoiler check: only pace and quality, never story.
 */
export function fallbackVerdict(t: Trend): { verdict: Verdict; tryUntil: Position | null; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  if (t.delta != null && t.nextAvg != null && t.watchedAvg != null) {
    if (t.delta >= 0.3) reasons.push(`Ratings climb from here: the next episodes average ${t.nextAvg} against ${t.watchedAvg} so far.`);
    else if (t.delta <= -0.3) reasons.push(`Ratings dip after this point: the next episodes average ${t.nextAvg}, down from ${t.watchedAvg}.`);
    else reasons.push(`It holds steady from here: the next episodes rate about the same as what you’ve seen (${t.nextAvg}).`);
  }
  const peak = t.peaksAhead[0];
  if (peak) reasons.push(`Its best-rated stretch is still ahead, around season ${peak.season}, episode ${peak.episode}.`);
  if (t.episodesAhead) reasons.push(`There are ${t.episodesAhead} episodes still to go.`);
  if (!reasons.length) reasons.push("There isn’t enough rating data on the episodes ahead to say much more.");

  let verdict: Verdict = "keep";
  let tryUntil: Position | null = null;
  if (t.delta == null) verdict = "keep";
  else if (t.delta >= 0.3) verdict = "keep";
  else if (t.pickup) {
    verdict = "try";
    tryUntil = t.pickup;
  } else if (t.delta <= -0.3) verdict = "stop";
  else if (t.episodesAhead > 3 && t.soon) {
    verdict = "try";
    tryUntil = t.soon;
  }
  const confidence = t.delta == null ? 0.3 : Math.min(0.8, 0.45 + Math.abs(t.delta) / 2);
  return { verdict, tryUntil, confidence: Math.round(confidence * 100) / 100, reasons: reasons.slice(0, 3) };
}
