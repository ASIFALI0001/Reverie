/**
 * Shared watchlists sort by a combined match that protects whoever is least keen (pure, tested):
 *
 *   combined = mean(m) − 0.6 · Σ max(0, 50 − m_i)        clamped to 0–100
 *
 * Anyone below 50% pulls a title down hard: a member at 30% costs 12 points on top of lowering
 * the mean, so "great for two of us, awful for the third" sinks below "good for everyone".
 * Members without a taste profile yet are left out of the sum. Ties go to the title whose
 * lowest individual match is highest.
 */

export const LOW_MATCH_LINE = 50;
export const LOW_MATCH_PENALTY = 0.6;

const known = (ms: (number | null | undefined)[]) => ms.filter((m): m is number => typeof m === "number" && Number.isFinite(m));

export function combinedMatch(matches: (number | null | undefined)[]): number | null {
  const ms = known(matches);
  if (!ms.length) return null;
  const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
  const penalty = LOW_MATCH_PENALTY * ms.reduce((sum, m) => sum + Math.max(0, LOW_MATCH_LINE - m), 0);
  return Math.round(Math.max(0, Math.min(100, mean - penalty)));
}

export function lowestMatch(matches: (number | null | undefined)[]): number | null {
  const ms = known(matches);
  return ms.length ? Math.min(...ms) : null;
}

/** Best for the group first; titles nobody can score yet go last, in the order they were added. */
export function rankForGroup<T extends { matches: (number | null)[] }>(items: T[]): (T & { combined: number | null; lowest: number | null })[] {
  return items
    .map((item, i) => ({ item, i, combined: combinedMatch(item.matches), lowest: lowestMatch(item.matches) }))
    .sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1) || (b.lowest ?? -1) - (a.lowest ?? -1) || a.i - b.i)
    .map((s) => ({ ...s.item, combined: s.combined, lowest: s.lowest }));
}
