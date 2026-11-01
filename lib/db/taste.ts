import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import type { TitleKey } from "@/lib/catalog/types";
import type { Affinity } from "@/lib/reco/affinity";
import type { Signal } from "@/lib/reco/weights";
import type { RadarPoint, SwipeVerdict, TasteAnswers } from "@/lib/taste/types";

/**
 * `tasteProfiles` (brief §5.2). Affinities are stored as `{ term, value, n }`
 * arrays rather than objects keyed by term: TMDB keywords can contain dots,
 * which don't belong in Mongo field names.
 */
export type TasteProfileDoc = {
  uid: string;
  answers: TasteAnswers | null;
  onboarding: {
    swipes: { key: TitleKey; verdict: SwipeVerdict; at: Date }[];
    favourites: { key: TitleKey; at: Date }[];
    completedAt: Date;
  } | null;
  /** Snapshot of the merged signals at the last rebuild (the source of truth is the library, watchlist and onboarding). */
  signals: Signal[];
  signalCount: number;
  tasteVector: number[] | null;
  /** How many signals with embeddings shaped the vector. */
  vectorSignals: number;
  answerVector: number[] | null;
  answerHash: string | null;
  /** 101 cosine percentiles of the taste vector over a catalog sample, so match scores spread out. */
  vectorPercentiles: number[] | null;
  genreAffinity: Affinity[];
  keywordAffinity: Affinity[];
  peopleAffinity: Affinity[];
  collectionAffinity: Affinity[];
  languageAffinity: Affinity[];
  vibePreference: { pace: number; tone: number; complexity: number } | null;
  era: { answer: number | null; meanYear: number | null };
  radar: RadarPoint[];
  tasteSummary: string | null;
  tasteDNA: string[];
  summarySource: "gemini" | "fallback" | null;
  /** Signal count when the summary was last written; it's regenerated every ~5 new signals. */
  summarySignalCount: number;
  /** Hash of the viewer's reactions when the summary was last written; any new or changed review regenerates it. */
  summaryReviewHash?: string | null;
  /** In the Taste Twins pool (opted in, not blocked, enough taste): the taste_vec index filters on it. */
  twinEligible?: boolean;
  /**
   * The taste other people may compare against: built like the above but without the titles
   * the user hid from friends. Friend matches, comparisons and Taste Twins read only these.
   */
  socialVector?: number[] | null;
  socialGenreAffinity?: Affinity[];
  version: number;
  dirty: boolean;
  dirtyAt: Date | null;
  leaseUntil: Date | null;
  builtAt: Date | null;
  updatedAt: Date;
};

export async function tasteCol() {
  await connectDb();
  return mongoose.connection.db!.collection<TasteProfileDoc>("tasteProfiles");
}
