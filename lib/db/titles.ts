import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import type { Ratings, TitleCore, TitleKey, Vibe } from "@/lib/catalog/types";
import type { JikanInfo } from "@/lib/sources/jikan";

/**
 * The catalog uses the native driver (through Mongoose's connection): it's
 * mostly bulk upserts and $vectorSearch aggregations, and the brief's
 * `collection` field is a reserved path name in Mongoose schemas.
 */
export type TitleDoc = TitleCore & {
  _id: TitleKey;
  ratings: Ratings;
  vibe: Vibe | null;
  /** Poster-derived palette; `forPoster` lets us recompute when TMDB swaps the poster. */
  colors: { dominant: string; accentDark: string; accentLight: string; forPoster: string } | null;
  posterBlur: string | null;
  jikan: JikanInfo | null;
  jikanCheckedAt: Date | null;
  profileText: string;
  profileHash: string | null;
  embedding?: number[];
  embedModel: string | null;
  detailsFetchedAt: Date;
  enrichedAt: Date | null;
  ratingsUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const VECTOR_INDEX = "titles_vec";

/** What lists and cards need — never the embedding or long-form extras. */
export const CARD_PROJECTION = {
  embedding: 0,
  profileText: 0,
  reviews: 0,
  videos: 0,
  tmdbRecs: 0,
  tmdbSimilar: 0,
  writers: 0,
  companies: 0,
  networks: 0,
  keywordIds: 0,
} as const;

export async function titlesCol() {
  await connectDb();
  return mongoose.connection.db!.collection<TitleDoc>("titles");
}

export const EMPTY_RATINGS: Ratings = {
  imdb: null,
  imdbVotes: null,
  rottenTomatoes: null,
  metacritic: null,
  tmdb: null,
  tmdbVotes: null,
  mal: null,
};
