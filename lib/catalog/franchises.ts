/**
 * Named franchise shelves. IDs verified against the TMDB API (2026-10-24).
 * Anything not listed still gets a shelf automatically in the library when two
 * or more titles share a TMDB collection (Baahubali, K.G.F, Pushpa…).
 */
export type FranchiseRule = {
  slug: string;
  name: string;
  companies?: number[];
  collections?: number[];
  keywords?: number[];
};

export const FRANCHISES: FranchiseRule[] = [
  {
    slug: "marvel",
    name: "Marvel",
    companies: [420, 7505, 13252, 11106],
    collections: [86311, 131292, 748, 573436],
    keywords: [180547],
  },
  { slug: "dc", name: "DC", companies: [184898, 128064, 9993, 429], collections: [120794, 263], keywords: [229266] },
  { slug: "star-wars", name: "Star Wars", collections: [10, 1797552], keywords: [379196] },
  { slug: "wizarding-world", name: "Wizarding World", collections: [1241, 435259] },
  { slug: "middle-earth", name: "Middle-earth", collections: [119, 121938, 141290] },
  { slug: "jurassic", name: "Jurassic", collections: [328] },
  { slug: "fast-and-furious", name: "Fast & Furious", collections: [9485] },
  { slug: "james-bond", name: "James Bond", collections: [645] },
  { slug: "mission-impossible", name: "Mission: Impossible", collections: [87359] },
  { slug: "the-matrix", name: "The Matrix", collections: [2344] },
  { slug: "john-wick", name: "John Wick", collections: [404609] },
  { slug: "monsterverse", name: "MonsterVerse", keywords: [380322] },
  { slug: "conjuring", name: "The Conjuring", collections: [313086] },
  { slug: "transformers", name: "Transformers", collections: [8650] },
  { slug: "pirates", name: "Pirates of the Caribbean", collections: [295] },
  { slug: "planet-of-the-apes", name: "Planet of the Apes", collections: [1709, 173710] },
  { slug: "alien", name: "Alien", collections: [8091] },
  { slug: "terminator", name: "The Terminator", collections: [528] },
  { slug: "indiana-jones", name: "Indiana Jones", collections: [84] },
  { slug: "hunger-games", name: "The Hunger Games", collections: [131635, 1701563] },
  { slug: "dune", name: "Dune", collections: [726871] },
  { slug: "pixar", name: "Pixar", companies: [3] },
  { slug: "disney-animation", name: "Disney Animation", companies: [6125, 158526] },
  { slug: "ghibli", name: "Studio Ghibli", companies: [10342] },
  { slug: "dreamworks", name: "DreamWorks Animation", companies: [521, 42141] },
  { slug: "illumination", name: "Illumination", companies: [6704] },
];

export const FRANCHISE_NAME = Object.fromEntries(FRANCHISES.map((f) => [f.slug, f.name])) as Record<string, string>;

export function detectFranchises(input: {
  companyIds: number[];
  collectionId: number | null;
  keywordIds: number[];
}): string[] {
  const companies = new Set(input.companyIds);
  const keywords = new Set(input.keywordIds);
  return FRANCHISES.filter(
    (f) =>
      f.companies?.some((c) => companies.has(c)) ||
      (input.collectionId != null && f.collections?.includes(input.collectionId)) ||
      f.keywords?.some((k) => keywords.has(k)),
  ).map((f) => f.slug);
}

/** Anime sub-shelves, from TMDB keyword ids (Jikan refines these when available). */
export const ANIME_TAG_KEYWORDS: Record<string, number[]> = {
  shonen: [207826],
  seinen: [195668],
  shojo: [206437],
  josei: [229074],
  isekai: [237451],
  mecha: [10046, 384065, 207473],
  "slice-of-life": [9914],
  psychological: [272553, 12565, 288859],
};

export const ANIME_TAG_NAME: Record<string, string> = {
  shonen: "Shōnen",
  seinen: "Seinen",
  shojo: "Shōjo",
  josei: "Josei",
  isekai: "Isekai",
  mecha: "Mecha",
  "slice-of-life": "Slice of Life",
  psychological: "Psychological",
  romance: "Romance",
  sports: "Sports",
};

export function detectAnimeTags(keywordIds: number[]): string[] {
  const ids = new Set(keywordIds);
  return Object.entries(ANIME_TAG_KEYWORDS)
    .filter(([, list]) => list.some((k) => ids.has(k)))
    .map(([tag]) => tag);
}
