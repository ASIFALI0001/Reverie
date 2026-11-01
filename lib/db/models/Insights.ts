import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Per-user records the newer features learn from: mood sessions, taste snapshots and eras,
 * taste twins, and the small feedback signals (why-not, series decisions).
 */

// ── Mood Search sessions ────────────────────────────────────────────────────

const MoodSessionSchema = new Schema(
  {
    uid: { type: String, required: true },
    mood: {
      preset: { type: String, default: null },
      text: { type: String, default: null, maxlength: 200 },
    },
    time: { type: String, enum: ["short", "film", "long", "binge"], required: true },
    company: { type: String, enum: ["alone", "partner", "friends", "family"], default: null },
    onlyMyServices: { type: Boolean, default: false },
    /** The structured target the mood mapped to (see lib/mood/target.ts). */
    target: { type: Schema.Types.Mixed, default: null },
    picks: {
      type: [{ _id: false, key: { type: String, required: true }, score: { type: Number, default: null }, reason: { type: String, default: "" } }],
      default: [],
    },
    /** Ranked runners-up, in order: "Not this" swaps the next one in. */
    spares: {
      type: [{ _id: false, key: { type: String, required: true }, score: { type: Number, default: null }, reason: { type: String, default: "" } }],
      default: [],
    },
    /** Titles swapped out with "Not this". */
    swapped: { type: [String], default: [] },
    chosenKey: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "moodSessions", versionKey: false },
);
MoodSessionSchema.index({ uid: 1, createdAt: -1 });

export type MoodSessionDoc = InferSchemaType<typeof MoodSessionSchema> & { _id: unknown };
export const MoodSession: Model<MoodSessionDoc> =
  (models.MoodSession as Model<MoodSessionDoc>) ?? model<MoodSessionDoc>("MoodSession", MoodSessionSchema);

// ── Taste snapshots (one per user per month) ────────────────────────────────

const TermValue = { _id: false, term: { type: String, required: true }, value: { type: Number, required: true } };

const TasteSnapshotSchema = new Schema(
  {
    uid: { type: String, required: true },
    /** First instant of the month (UTC). */
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    count: { type: Number, required: true },
    hours: { type: Number, default: 0 },
    avgRating: { type: Number, default: null },
    /** Share of the month's titles per genre (sums to 1). */
    genreShare: { type: [TermValue], default: [] },
    /** Rating-weighted affinity per genre, −1…1. */
    genreAffinity: { type: [TermValue], default: [] },
    vibe: { type: { _id: false, pace: Number, tone: Number, complexity: Number }, default: null },
    /** Weighted mean of the month's title embeddings (normalized), for era boundaries. */
    vector: { type: [Number], default: null },
    topTitles: {
      type: [{ _id: false, key: String, title: String, posterPath: String, rating: Number }],
      default: [],
    },
    /** Hash of the month's inputs: a snapshot is rebuilt only when this changes. */
    hash: { type: String, required: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { collection: "tasteSnapshots", versionKey: false },
);
TasteSnapshotSchema.index({ uid: 1, periodStart: 1 }, { unique: true });

export type TasteSnapshotDoc = InferSchemaType<typeof TasteSnapshotSchema> & { _id: unknown };
export const TasteSnapshot: Model<TasteSnapshotDoc> =
  (models.TasteSnapshot as Model<TasteSnapshotDoc>) ?? model<TasteSnapshotDoc>("TasteSnapshot", TasteSnapshotSchema);

/** The derived timeline (eras with their names), cached until the snapshots change. */
const TasteTimelineSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    hash: { type: String, required: true },
    eras: { type: Schema.Types.Mixed, default: [] },
    builtAt: { type: Date, default: () => new Date() },
  },
  { collection: "tasteTimelines", versionKey: false },
);

export type TasteTimelineDoc = InferSchemaType<typeof TasteTimelineSchema> & { _id: unknown };
export const TasteTimeline: Model<TasteTimelineDoc> =
  (models.TasteTimeline as Model<TasteTimelineDoc>) ?? model<TasteTimelineDoc>("TasteTimeline", TasteTimelineSchema);

// ── Taste twins ─────────────────────────────────────────────────────────────

const TasteTwinsSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    /** The viewer's profile version these were computed for. */
    profileVersion: { type: Number, required: true },
    twins: {
      type: [
        {
          _id: false,
          twinUid: { type: String, required: true },
          score: { type: Number, required: true },
          parts: { _id: false, vector: Number, ratings: { type: Number, default: null }, genres: Number },
          /** Titles both rated 8+ (never hidden ones). */
          sharedLoved: { type: [String], default: [] },
          computedAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    computedAt: { type: Date, default: () => new Date() },
  },
  { collection: "tasteTwins", versionKey: false },
);

export type TasteTwinsDoc = InferSchemaType<typeof TasteTwinsSchema> & { _id: unknown };
export const TasteTwins: Model<TasteTwinsDoc> =
  (models.TasteTwins as Model<TasteTwinsDoc>) ?? model<TasteTwinsDoc>("TasteTwins", TasteTwinsSchema);

// ── Small feedback signals ──────────────────────────────────────────────────

/** "Was this right?" on a why-not explanation. A weak signal for the taste profile. */
const WhyNotFeedbackSchema = new Schema(
  {
    uid: { type: String, required: true },
    key: { type: String, required: true },
    helpful: { type: Boolean, required: true },
    score: { type: Number, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "whyNotFeedback", versionKey: false },
);
WhyNotFeedbackSchema.index({ uid: 1, key: 1 }, { unique: true });

export type WhyNotFeedbackDoc = InferSchemaType<typeof WhyNotFeedbackSchema> & { _id: unknown };
export const WhyNotFeedback: Model<WhyNotFeedbackDoc> =
  (models.WhyNotFeedback as Model<WhyNotFeedbackDoc>) ?? model<WhyNotFeedbackDoc>("WhyNotFeedback", WhyNotFeedbackSchema);

/** What the viewer did after "Should I keep going?". */
const SeriesDecisionSchema = new Schema(
  {
    uid: { type: String, required: true },
    key: { type: String, required: true },
    decision: { type: String, enum: ["kept", "stopped"], required: true },
    season: { type: Number, required: true },
    episode: { type: Number, required: true },
    verdict: { type: String, default: null },
    at: { type: Date, default: () => new Date() },
  },
  { collection: "seriesDecisions", versionKey: false },
);
SeriesDecisionSchema.index({ uid: 1, key: 1, at: -1 });

export type SeriesDecisionDoc = InferSchemaType<typeof SeriesDecisionSchema> & { _id: unknown };
export const SeriesDecision: Model<SeriesDecisionDoc> =
  (models.SeriesDecision as Model<SeriesDecisionDoc>) ?? model<SeriesDecisionDoc>("SeriesDecision", SeriesDecisionSchema);
