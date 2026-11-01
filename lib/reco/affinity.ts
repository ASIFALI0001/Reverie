import type { TitleKey } from "@/lib/catalog/types";
import type { Signal } from "@/lib/reco/weights";
import { knownChips } from "@/lib/taste/chips";
import type { RadarPoint, TasteAnswers } from "@/lib/taste/types";

/** Feature-side taste: what a viewer's signals say about genres, themes, people… (pure, unit-tested). */

export type TitleFeatures = {
  key: TitleKey;
  title: string;
  year: number | null;
  genres: string[];
  keywords: string[];
  themes: string[];
  mood: string[];
  /** "d:<id>" for directors/creators, "a:<id>" for the top-billed cast. */
  people: string[];
  /** "c:<id>" for a TMDB collection. */
  collection: string | null;
  /** "f:<slug>" for our curated franchises. */
  franchises: string[];
  language: string;
  vibe: { pace: number; tone: number; complexity: number } | null;
};

export type Affinity = { term: string; value: number; n: number };

export type Affinities = {
  genre: Affinity[];
  keyword: Affinity[];
  people: Affinity[];
  collection: Affinity[];
  language: Affinity[];
};

type Dim = "pace" | "tone" | "complexity";
const DIMS: Dim[] = ["pace", "tone", "complexity"];

/** An onboarding pick counts like one liked title. */
const PRIOR = 0.6;

const round = (x: number) => Math.round(x * 1000) / 1000;

/** tanh(2·Σw / (n + k)): one loved title moves a term to ~0.5, ten to ~0.9; thin evidence stays near 0. */
export function affinityScore(sum: number, n: number, k = 2): number {
  return n + k === 0 ? 0 : Math.tanh((2 * sum) / (n + k));
}

class Tally {
  private terms = new Map<string, { sum: number; n: number; prior: boolean }>();

  add(term: string, w: number, prior = false) {
    const t = this.terms.get(term) ?? { sum: 0, n: 0, prior: false };
    t.sum += w;
    t.n += 1;
    t.prior ||= prior;
    this.terms.set(term, t);
  }

  result({ minN = 1, limit = Infinity }: { minN?: number; limit?: number } = {}): Affinity[] {
    return [...this.terms.entries()]
      .filter(([, t]) => t.n >= minN || t.prior)
      .map(([term, t]) => ({ term, value: round(affinityScore(t.sum, t.n)), n: t.n }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || b.n - a.n)
      .slice(0, limit);
  }
}

export function computeAffinities(signals: Signal[], features: Map<TitleKey, TitleFeatures>, answers: TasteAnswers | null): Affinities {
  const genre = new Tally();
  const keyword = new Tally();
  const people = new Tally();
  const collection = new Tally();
  const language = new Tally();

  for (const s of signals) {
    const f = features.get(s.key);
    if (!f) continue;
    for (const g of new Set(f.genres)) genre.add(g, s.weight);
    for (const k of new Set([...f.themes, ...f.mood, ...f.keywords.slice(0, 12)])) keyword.add(k, s.weight);
    for (const p of new Set(f.people)) people.add(p, s.weight);
    for (const c of new Set([...(f.collection ? [f.collection] : []), ...f.franchises])) collection.add(c, s.weight);
    if (f.language) language.add(f.language, s.weight);
  }

  for (const chip of knownChips(answers?.genres ?? [])) {
    for (const g of new Set(chip.genres ?? [])) genre.add(g, PRIOR, true);
    for (const m of chip.moods ?? []) keyword.add(m, PRIOR, true);
  }
  for (const l of new Set(answers?.languages ?? [])) language.add(l, PRIOR, true);

  return {
    genre: genre.result(),
    keyword: keyword.result({ minN: 2, limit: 80 }),
    people: people.result({ limit: 60 }),
    collection: collection.result({ limit: 40 }),
    language: language.result(),
  };
}

/**
 * Preferred pace/tone/complexity: the answers (or the lean of picked moods)
 * blended with the vibe of titles the viewer liked. Titles take over as evidence grows.
 */
export function vibePreference(
  signals: Signal[],
  features: Map<TitleKey, TitleFeatures>,
  answers: TasteAnswers | null,
): Record<Dim, number> | null {
  const acc: Record<Dim, number> = { pace: 0, tone: 0, complexity: 0 };
  let total = 0;
  let count = 0;
  for (const s of signals) {
    const v = s.weight > 0 ? features.get(s.key)?.vibe : null;
    if (!v) continue;
    total += s.weight;
    count++;
    for (const d of DIMS) acc[d] += s.weight * v[d];
  }

  const chips = knownChips(answers?.genres ?? []);
  const lean = (d: Dim) => {
    const leans = chips.map((c) => c.lean?.[d]).filter((x): x is number => x != null);
    return leans.length ? leans.reduce((a, b) => a + b, 0) / leans.length : null;
  };
  const answerWeight = count >= 10 ? 0.35 : 0.5;

  const out = {} as Record<Dim, number | null>;
  for (const d of DIMS) {
    const fromTitles = total > 0 ? acc[d] / total : null;
    const fromAnswers = answers?.[d] ?? lean(d);
    out[d] =
      fromAnswers != null && fromTitles != null
        ? answerWeight * fromAnswers + (1 - answerWeight) * fromTitles
        : (fromAnswers ?? fromTitles);
  }
  if (DIMS.every((d) => out[d] == null)) return null;
  return { pace: round(out.pace ?? 0.5), tone: round(out.tone ?? 0.5), complexity: round(out.complexity ?? 0.5) };
}

/** The viewer's era: their answer (0 new … 1 classics) and the weighted mean year of what they liked. */
export function eraPreference(signals: Signal[], features: Map<TitleKey, TitleFeatures>, answers: TasteAnswers | null) {
  let sum = 0;
  let total = 0;
  for (const s of signals) {
    const year = s.weight > 0 ? features.get(s.key)?.year : null;
    if (!year) continue;
    sum += s.weight * year;
    total += s.weight;
  }
  return { answer: answers?.era ?? null, meanYear: total > 0 ? Math.round(sum / total) : null };
}

export const RADAR_AXES: { axis: string; genres: string[] }[] = [
  { axis: "Action", genres: ["Action", "Action & Adventure", "Adventure", "War", "War & Politics", "Western"] },
  { axis: "Comedy", genres: ["Comedy"] },
  { axis: "Drama", genres: ["Drama", "History"] },
  { axis: "Romance", genres: ["Romance"] },
  { axis: "Horror", genres: ["Horror"] },
  { axis: "Thriller", genres: ["Thriller", "Crime", "Mystery"] },
  { axis: "Sci-fi", genres: ["Science Fiction", "Sci-Fi & Fantasy", "Fantasy"] },
  { axis: "Family", genres: ["Family", "Kids", "Animation"] },
];

/** Eight genre axes, each the evidence-weighted mean of its genres' affinities, mapped to 0–1 (0.5 = neutral). */
export function radarFrom(genre: Affinity[]): RadarPoint[] {
  const by = new Map(genre.map((g) => [g.term, g]));
  return RADAR_AXES.map(({ axis, genres }) => {
    let sum = 0;
    let n = 0;
    let evidence = 0;
    for (const g of genres) {
      const a = by.get(g);
      if (!a) continue;
      sum += a.value * a.n;
      n += a.n;
      evidence = Math.max(evidence, a.n);
    }
    const mean = n > 0 ? sum / n : 0;
    return { axis, value: round((mean + 1) / 2), evidence };
  });
}

const GENRE_PHRASE: Record<string, string> = {
  "Science Fiction": "sci-fi",
  "Sci-Fi & Fantasy": "sci-fi and fantasy",
  "Action & Adventure": "action and adventure",
  "War & Politics": "war and politics",
  "TV Movie": "TV movies",
};
const phrase = (g: string) => GENRE_PHRASE[g] ?? g.toLowerCase();

/**
 * Taste DNA without the model: used when Gemini is unavailable, so the reveal
 * never comes up empty. Always returns 3–4 short phrases.
 */
export function fallbackDna(aff: Affinities, vibe: Record<Dim, number> | null, answers: TasteAnswers | null): string[] {
  const out: string[] = [];
  const liked = aff.genre.filter((g) => g.value > 0.2).sort((a, b) => b.value - a.value);
  if (liked[0] && liked[1]) out.push(`Drawn to ${phrase(liked[0].term)} and ${phrase(liked[1].term)}`);
  else if (liked[0]) out.push(`Loves a good ${phrase(liked[0].term)}`);

  if (vibe) {
    if (vibe.complexity >= 0.62) out.push("Likes being made to think");
    else if (vibe.complexity <= 0.35) out.push("Happiest with an easy watch");
    if (vibe.pace <= 0.38) out.push("Patient with a slow burn");
    else if (vibe.pace >= 0.65) out.push("Likes it fast and loud");
    if (vibe.tone >= 0.65) out.push("Leans toward the dark");
    else if (vibe.tone <= 0.32) out.push("Here for the warmth");
  }

  const disliked = aff.genre.filter((g) => g.value < -0.3).sort((a, b) => a.value - b.value)[0];
  if (disliked) out.push(`Not a fan of ${phrase(disliked.term)}`);

  const formats = answers?.formats ?? [];
  const fillers = [
    ...(formats.includes("anime") ? ["Open to anime"] : []),
    ...(formats.length >= 3 ? ["Watches across every format"] : []),
    "Open to surprises",
    "Every genre still in play",
    "Still taking shape",
  ];
  for (const f of fillers) if (out.length < 3 && !out.includes(f)) out.push(f);
  return out.slice(0, 4);
}
