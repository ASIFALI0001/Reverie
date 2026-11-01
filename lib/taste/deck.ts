import type { Category, TitleKey } from "@/lib/catalog/types";
import { chipMatches, knownChips } from "@/lib/taste/chips";

/** Choosing the onboarding swipe deck (pure and seeded, so a user's deck is stable for the day). */

export type DeckCandidate = {
  key: TitleKey;
  category: Category;
  title: string;
  genres: string[];
  vibe: { pace: number; tone: number; complexity: number; mood: string[]; themes: string[] } | null;
  voteCount: number;
  originalLanguage: string;
  collectionId: number | null;
  franchises: string[];
  hasEmbedding: boolean;
};

const ALL: Category[] = ["movie", "series", "anime", "cartoon"];
// Films are what most people have seen the most of, so they get the biggest share.
const CATEGORY_WEIGHT: Record<Category, number> = { movie: 2, series: 1.5, anime: 1, cartoon: 1 };
/** Share of each format's slots that match the picked chips; the rest are contrast titles that teach us dislikes. */
const MATCHED_SHARE = 0.65;

/** mulberry32: tiny deterministic PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, for seeding. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Split `size` cards across formats by weight (largest remainder); a short format's leftovers go to the others. */
export function quotas(formats: Category[], available: Record<Category, number>, size: number): Record<Category, number> {
  const out: Record<Category, number> = { movie: 0, series: 0, anime: 0, cartoon: 0 };
  let open = formats.filter((c) => available[c] > 0);
  let remaining = Math.min(size, open.reduce((s, c) => s + available[c], 0));

  while (remaining > 0 && open.length) {
    const totalW = open.reduce((s, c) => s + CATEGORY_WEIGHT[c], 0);
    const shares = open.map((c) => {
      const exact = (remaining * CATEGORY_WEIGHT[c]) / totalW;
      return { c, exact, n: Math.floor(exact) };
    });
    let given = shares.reduce((s, x) => s + x.n, 0);
    for (const x of [...shares].sort((a, b) => b.exact - b.n - (a.exact - a.n))) {
      if (given >= remaining) break;
      x.n++;
      given++;
    }
    let used = 0;
    for (const x of shares) {
      const take = Math.min(available[x.c] - out[x.c], x.n);
      out[x.c] += take;
      used += take;
    }
    remaining -= used;
    open = open.filter((c) => out[c] < available[c]);
    if (used === 0) break;
  }
  return out;
}

type DeckOptions = {
  formats: Category[];
  chips: string[];
  /** Non-English original languages to nudge in (e.g. Hindi for viewers in India). */
  boostLanguages: string[];
  size?: number;
  seed: number;
};

export function pickDeck(candidates: DeckCandidate[], opts: DeckOptions): DeckCandidate[] {
  const size = opts.size ?? 20;
  const random = rng(opts.seed);
  const chips = knownChips(opts.chips);
  const formats = opts.formats.length ? ALL.filter((c) => opts.formats.includes(c)) : ALL;

  const byCat = new Map<Category, DeckCandidate[]>(formats.map((c) => [c, []]));
  for (const c of candidates) byCat.get(c.category)?.push(c);
  const available = Object.fromEntries(ALL.map((c) => [c, byCat.get(c)?.length ?? 0])) as Record<Category, number>;
  const quota = quotas(formats, available, size);

  const jitter = new Map(candidates.map((c) => [c.key, random()]));
  const matched = (c: DeckCandidate) => chips.some((chip) => chipMatches(chip, { genres: c.genres, vibe: c.vibe }));
  const base = (c: DeckCandidate) =>
    Math.log10(c.voteCount + 10) +
    (c.hasEmbedding ? 0.6 : 0) +
    (c.originalLanguage !== "en" && opts.boostLanguages.includes(c.originalLanguage) ? 0.5 : 0) +
    (jitter.get(c.key) ?? 0) * 1.2;

  const picks: DeckCandidate[] = [];
  // Diversity: one title per collection, few per franchise, and a spread of lead genres.
  const penalty = (c: DeckCandidate) => {
    let p = 0;
    for (const x of picks) {
      if (c.collectionId != null && x.collectionId === c.collectionId) p += 4;
      for (const f of c.franchises) if (x.franchises.includes(f)) p += 1.2;
      if (c.genres[0] && x.genres[0] === c.genres[0]) p += 0.2;
    }
    return p;
  };
  const take = (pool: DeckCandidate[], n: number) => {
    for (let i = 0; i < n && pool.length; i++) {
      let best = 0;
      let bestScore = -Infinity;
      pool.forEach((c, j) => {
        const s = base(c) - penalty(c);
        if (s > bestScore) {
          bestScore = s;
          best = j;
        }
      });
      picks.push(pool.splice(best, 1)[0]!);
    }
  };

  for (const cat of formats) {
    const n = quota[cat];
    const pool = byCat.get(cat) ?? [];
    if (!n) continue;
    if (!chips.length) {
      take(pool, n);
      continue;
    }
    const yes = pool.filter(matched);
    const no = pool.filter((c) => !matched(c));
    const start = picks.length;
    take(yes, Math.round(n * MATCHED_SHARE));
    take(no, n - (picks.length - start));
    take(yes, n - (picks.length - start)); // backfill if the contrast pool ran dry
  }
  return order(picks, random);
}

/** The best-known title first (an easy opener), then a shuffle that avoids two of the same format in a row. */
function order(picks: DeckCandidate[], random: () => number): DeckCandidate[] {
  if (picks.length < 2) return picks;
  const first = picks.reduce((a, b) => (b.voteCount > a.voteCount ? b : a));
  const rest = picks.filter((p) => p !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  const out = [first];
  while (rest.length) {
    const last = out[out.length - 1]!;
    const i = rest.findIndex((p) => p.category !== last.category);
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0]!);
  }
  return out;
}
