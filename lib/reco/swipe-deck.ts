import "server-only";
import { connectDb } from "@/lib/db/connect";
import { titlesCol } from "@/lib/db/titles";
import { LibraryItem, WatchlistItem } from "@/lib/db/models/Library";
import { User } from "@/lib/db/models/User";
import { hashSeed, pickDeck, type DeckCandidate } from "@/lib/taste/deck";
import { REGION_LANGUAGES } from "@/lib/taste/languages";
import type { Category, TitleKey } from "@/lib/catalog/types";
import type { DeckCard } from "@/lib/taste/types";

const ALL: Category[] = ["movie", "series", "anime", "cartoon"];
/** "Well-known" differs by format: anime and cartoons have smaller TMDB vote counts. */
const MIN_VOTES: Record<Category, number> = { movie: 1500, series: 400, anime: 150, cartoon: 400 };
const POOL = 160;

type Row = DeckCandidate & {
  year: number | null;
  posterPath: string;
  posterBlur: string | null;
  color: string | null;
};

/** ~20 famous, varied titles for the swipe step, adapted to the formats and chips picked so far. */
export async function buildSwipeDeck(uid: string, opts: { formats: Category[]; chips: string[]; size?: number }): Promise<DeckCard[]> {
  await connectDb();
  const formats = opts.formats.length ? opts.formats : ALL;
  const [user, lib, wl] = await Promise.all([
    User.findById(uid, { region: 1, languages: 1 }).lean(),
    LibraryItem.find({ uid }, { key: 1 }).lean(),
    WatchlistItem.find({ uid }, { key: 1 }).lean(),
  ]);
  // Titles they've already logged tell us nothing new.
  const known = [...lib, ...wl].map((x) => x.key as TitleKey);

  const col = await titlesCol();
  const pools = await Promise.all(
    formats.map((category) =>
      col
        .aggregate<Row>([
          {
            $match: {
              category,
              _id: { $nin: known },
              posterPath: { $ne: null },
              vibe: { $ne: null },
              voteCount: { $gte: MIN_VOTES[category] },
            },
          },
          { $sort: { voteCount: -1 } },
          { $limit: POOL },
          {
            $project: {
              _id: 0,
              key: "$_id",
              category: 1,
              title: 1,
              year: 1,
              genres: 1,
              vibe: { pace: 1, tone: 1, complexity: 1, mood: 1, themes: 1 },
              voteCount: 1,
              originalLanguage: 1,
              collectionId: { $ifNull: ["$collection.id", null] },
              franchises: { $ifNull: ["$franchises", []] },
              hasEmbedding: { $gt: [{ $size: { $ifNull: ["$embedding", []] } }, 0] },
              posterPath: 1,
              posterBlur: 1,
              color: { $ifNull: ["$colors.dominant", null] },
            },
          },
        ])
        .toArray(),
    ),
  );

  const region = user?.region ?? "IN";
  const boostLanguages = [...new Set([...(user?.languages ?? []), ...(REGION_LANGUAGES[region] ?? [])])];
  const day = new Date().toISOString().slice(0, 10);
  const seed = hashSeed(`${uid}:${day}:${[...formats].sort().join(",")}:${[...opts.chips].sort().join(",")}`);

  const rows = pools.flat();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const deck = pickDeck(rows, { formats, chips: opts.chips, boostLanguages, seed, size: opts.size ?? 20 });
  return deck.map((d) => {
    const r = byKey.get(d.key)!;
    return {
      key: r.key,
      title: r.title,
      year: r.year,
      category: r.category,
      posterPath: r.posterPath,
      posterBlur: r.posterBlur ?? null,
      color: r.color,
      genres: r.genres.slice(0, 2),
    };
  });
}
