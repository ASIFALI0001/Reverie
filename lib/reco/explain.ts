import type { TitleFeatures } from "@/lib/reco/affinity";
import type { FeatureProfile } from "@/lib/reco/features";
import { vibeFit } from "@/lib/reco/features";

/**
 * Reasons and a caveat built from the feature evidence, for when Gemini is
 * unavailable. Plainer than the model's, but always true to the numbers.
 */

const GENRE_WORD: Record<string, string> = {
  "Science Fiction": "sci-fi",
  "Sci-Fi & Fantasy": "sci-fi and fantasy",
  "Action & Adventure": "action and adventure",
  "War & Politics": "war and politics",
};
const word = (g: string) => GENRE_WORD[g] ?? g.toLowerCase();

/** Display names for "d:525" / "a:3223" / "c:131292" / "f:marvel" terms. */
export type TermNames = Map<string, string>;

export function explainMatch(t: TitleFeatures, p: FeatureProfile, names: TermNames): { reasons: string[]; watchOut: string | null } {
  const reasons: string[] = [];

  const genres = t.genres
    .map((g) => ({ g, a: p.genre.get(g) }))
    .filter((x) => x.a && x.a.value > 0.3)
    .sort((x, y) => y.a!.value - x.a!.value);
  if (genres[0]) reasons.push(`Leans into ${word(genres[0].g)}, one of your strongest pulls`);

  const lineage = [...t.people, ...(t.collection ? [t.collection] : []), ...t.franchises]
    .map((term) => ({ term, a: p.people.get(term) ?? p.collection.get(term) }))
    .filter((x) => x.a && x.a.value > 0.3 && names.has(x.term))
    .sort((x, y) => y.a!.value - x.a!.value)[0];
  if (lineage) {
    const name = names.get(lineage.term)!;
    reasons.push(
      lineage.term.startsWith("d:")
        ? `From ${name}, whose work you rate highly`
        : lineage.term.startsWith("a:")
          ? `Stars ${name}, who turns up in titles you love`
          : `Part of ${name}, which you’ve enjoyed`,
    );
  }

  const themes = [...new Set([...t.themes, ...t.mood])]
    .map((term) => ({ term, a: p.keyword.get(term) }))
    .filter((x) => x.a && x.a.value > 0.25)
    .sort((x, y) => y.a!.value - x.a!.value)
    .slice(0, 2)
    .map((x) => x.term);
  if (themes.length) reasons.push(`Built on ${themes.join(" and ")}, threads that run through your favourites`);

  const fit = vibeFit(t.vibe, p.vibe);
  if (fit != null && fit > 0.68 && reasons.length < 3) reasons.push("Moves at the pace and in the tone you tend to prefer");

  if (reasons.length === 0) reasons.push("A broad fit with what you’ve told us so far");

  // The single most useful caveat.
  let watchOut: string | null = null;
  const disliked = t.genres
    .map((g) => ({ g, a: p.genre.get(g) }))
    .filter((x) => x.a && x.a.value < -0.3)
    .sort((x, y) => x.a!.value - y.a!.value)[0];
  if (disliked) watchOut = `It has a strong ${word(disliked.g)} streak, which usually isn’t for you`;
  else if (t.vibe && p.vibe) {
    const d = { pace: t.vibe.pace - p.vibe.pace, tone: t.vibe.tone - p.vibe.tone, complexity: t.vibe.complexity - p.vibe.complexity };
    const [k, v] = Object.entries(d).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]!;
    if (Math.abs(v) >= 0.3) {
      watchOut =
        k === "pace"
          ? v < 0 ? "Slower than you usually like" : "Busier and louder than you usually like"
          : k === "tone"
            ? v < 0 ? "Lighter in tone than you usually go for" : "Darker than you usually go for"
            : v < 0 ? "Simpler than the puzzles you usually enjoy" : "Asks more attention than you usually give";
    }
  }
  return { reasons: reasons.slice(0, 3), watchOut };
}

/** A short "why similar" line from shared features, for when Gemini can't write one. */
export function explainSimilar(source: TitleFeatures, c: TitleFeatures, names: TermNames): string {
  if (source.collection && source.collection === c.collection) return `Same story world: ${names.get(c.collection) ?? "the same series"}`;
  const franchise = source.franchises.find((f) => c.franchises.includes(f));
  if (franchise && names.has(franchise)) return `Also from ${names.get(franchise)}`;
  const director = source.people.find((p) => p.startsWith("d:") && c.people.includes(p));
  if (director && names.has(director)) return `Also from ${names.get(director)}`;
  const shared = [...new Set([...source.themes, ...source.mood])].filter((x) => c.themes.includes(x) || c.mood.includes(x));
  if (shared.length >= 2) return `Shares its ${shared.slice(0, 2).join(" and ")}`;
  const genres = source.genres.filter((g) => c.genres.includes(g)).map(word);
  if (genres.length) return `Same ${genres.slice(0, 2).join(" and ")} territory`;
  return "A close match in feel";
}
