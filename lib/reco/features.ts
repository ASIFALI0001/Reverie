import type { Affinity, TitleFeatures } from "@/lib/reco/affinity";

/**
 * Feature score (brief §5.3.2): how a title's genres, themes, people, vibe and
 * language/era line up with a viewer's affinities. Pure and unit-tested.
 * Every component is 0–1 with 0.5 meaning "no opinion", or null when there's
 * no evidence either way (it then drops out of the weighting).
 */

export type FeatureProfile = {
  genre: Map<string, Affinity>;
  keyword: Map<string, Affinity>;
  people: Map<string, Affinity>;
  collection: Map<string, Affinity>;
  language: Map<string, Affinity>;
  vibe: { pace: number; tone: number; complexity: number } | null;
  era: { answer: number | null; meanYear: number | null };
  subtitles: boolean | null;
  languages: string[];
};

type ProfileSource = {
  genreAffinity: Affinity[];
  keywordAffinity: Affinity[];
  peopleAffinity: Affinity[];
  collectionAffinity: Affinity[];
  languageAffinity: Affinity[];
  vibePreference: { pace: number; tone: number; complexity: number } | null;
  era: { answer: number | null; meanYear: number | null };
  answers: { subtitles: boolean | null; languages: string[] } | null;
};

const toMap = (xs: Affinity[]) => new Map(xs.map((a) => [a.term, a]));

export function featureProfile(p: ProfileSource): FeatureProfile {
  return {
    genre: toMap(p.genreAffinity),
    keyword: toMap(p.keywordAffinity),
    people: toMap(p.peopleAffinity),
    collection: toMap(p.collectionAffinity),
    language: toMap(p.languageAffinity),
    vibe: p.vibePreference,
    era: p.era,
    subtitles: p.answers?.subtitles ?? null,
    languages: p.answers?.languages ?? [],
  };
}

export const FEATURE_WEIGHTS = { genre: 0.3, keyword: 0.2, people: 0.15, vibe: 0.2, langEra: 0.15 } as const;
type Component = keyof typeof FEATURE_WEIGHTS;

export type FeatureBreakdown = Record<Component, number | null> & { score: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const toUnit = (affinity: number) => clamp01((affinity + 1) / 2);

/** Evidence-weighted mean affinity of the terms we have an opinion on; null if none. */
function meanAffinity(terms: Iterable<string>, map: Map<string, Affinity>): number | null {
  let sum = 0;
  let n = 0;
  for (const t of new Set(terms)) {
    const a = map.get(t);
    if (!a) continue;
    sum += a.value * a.n;
    n += a.n;
  }
  return n ? sum / n : null;
}

/** The strongest pull and the strongest push among matched terms (a loved director and a hated franchise both count). */
function strongest(terms: Iterable<string>, maps: Map<string, Affinity>[]): number | null {
  let best = 0;
  let worst = 0;
  let seen = false;
  for (const t of new Set(terms)) {
    for (const map of maps) {
      const a = map.get(t);
      if (!a) continue;
      seen = true;
      best = Math.max(best, a.value);
      worst = Math.min(worst, a.value);
    }
  }
  return seen ? Math.max(-1, Math.min(1, best + worst)) : null;
}

/** 1 = exactly the preferred feel; damped toward 0.5 when the preference itself is mild. */
export function vibeFit(title: FeatureProfile["vibe"], pref: FeatureProfile["vibe"]): number | null {
  if (!title || !pref) return null;
  const dist = (Math.abs(title.pace - pref.pace) + Math.abs(title.tone - pref.tone) + Math.abs(title.complexity - pref.complexity)) / 3;
  const fit = clamp01(1 - dist * 2);
  const decisive = (Math.abs(pref.pace - 0.5) + Math.abs(pref.tone - 0.5) + Math.abs(pref.complexity - 0.5)) / 1.5;
  return 0.5 + (fit - 0.5) * (0.35 + 0.65 * clamp01(decisive));
}

function languageFit(lang: string, p: FeatureProfile): number | null {
  const a = p.language.get(lang);
  if (a) return toUnit(a.value);
  if (p.languages.includes(lang)) return 0.65;
  if (p.subtitles === false && lang && !p.languages.includes(lang)) return 0.25;
  return null;
}

function eraFit(year: number | null, era: FeatureProfile["era"], nowYear: number): number | null {
  if (!year) return null;
  if (era.answer != null) {
    // 0 = new releases … 1 = classics; a title 40+ years old sits at the classic end.
    const position = clamp01((nowYear - year) / 40);
    return 1 - Math.abs(era.answer - position);
  }
  if (era.meanYear != null) return 0.5 + 0.5 * (1 - Math.min(1, Math.abs(year - era.meanYear) / 30)) - 0.25;
  return null;
}

export function featureScore(t: TitleFeatures, p: FeatureProfile, nowYear = new Date().getFullYear()): FeatureBreakdown {
  const genre = meanAffinity(t.genres, p.genre);
  const keyword = meanAffinity([...t.themes, ...t.mood, ...t.keywords.slice(0, 12)], p.keyword);
  const people = strongest([...t.people, ...(t.collection ? [t.collection] : []), ...t.franchises], [p.people, p.collection]);
  const lang = languageFit(t.language, p);
  const era = eraFit(t.year, p.era, nowYear);
  const langEra = lang != null && era != null ? (lang + era) / 2 : (lang ?? era);

  const parts: Record<Component, number | null> = {
    genre: genre == null ? null : toUnit(genre),
    keyword: keyword == null ? null : toUnit(keyword),
    people: people == null ? null : toUnit(people),
    vibe: vibeFit(t.vibe, p.vibe),
    langEra,
  };

  let sum = 0;
  let weight = 0;
  for (const k of Object.keys(FEATURE_WEIGHTS) as Component[]) {
    const v = parts[k];
    if (v == null) continue;
    sum += FEATURE_WEIGHTS[k] * v;
    weight += FEATURE_WEIGHTS[k];
  }
  return { ...parts, score: weight ? sum / weight : 0.5 };
}
