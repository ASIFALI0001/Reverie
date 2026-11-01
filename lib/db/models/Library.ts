import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const LIBRARY_STATUSES = ["watched", "watching", "dropped"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

const LibraryItemSchema = new Schema(
  {
    uid: { type: String, required: true },
    key: { type: String, required: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    category: { type: String, enum: ["movie", "series", "anime", "cartoon"], required: true },
    /** Auto shelves (genre/franchise/collection/anime tag), computed from the title on add. */
    shelves: { type: [String], default: [] },
    /** Custom shelf ids. */
    customShelves: { type: [String], default: [] },
    status: { type: String, enum: LIBRARY_STATUSES, default: "watched" },
    /** 1–10 in half-star steps (5 stars × 2). */
    rating: { type: Number, min: 1, max: 10, default: null },
    /** The viewer's review, in their own words (optional). */
    note: { type: String, maxlength: 2000, default: "" },
    /** Quick reactions after watching: ids from lib/library/reactions (what worked / what didn't). */
    worked: { type: [String], default: [] },
    didnt: { type: [String], default: [] },
    watchedAt: { type: Date, default: null },
    rewatchCount: { type: Number, min: 0, default: 0 },
    addedAt: { type: Date, default: () => new Date() },
    /** Never shown to friends, never used for friend boosts, Taste Twins or activity. */
    hiddenFromFriends: { type: Boolean, default: false },
    /** Series: where the viewer is (for "Should I keep going?"). */
    progress: {
      type: { _id: false, season: { type: Number, min: 0 }, episode: { type: Number, min: 1 } },
      default: null,
    },
  },
  { collection: "libraryItems", timestamps: true, versionKey: false },
);
LibraryItemSchema.index({ uid: 1, mediaType: 1, tmdbId: 1 }, { unique: true });
LibraryItemSchema.index({ uid: 1, category: 1, status: 1 });

export type LibraryItemDoc = InferSchemaType<typeof LibraryItemSchema> & { _id: unknown };
export const LibraryItem: Model<LibraryItemDoc> =
  (models.LibraryItem as Model<LibraryItemDoc>) ?? model<LibraryItemDoc>("LibraryItem", LibraryItemSchema);

const WatchlistSchema = new Schema(
  {
    uid: { type: String, required: true },
    key: { type: String, required: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    category: { type: String, enum: ["movie", "series", "anime", "cartoon"], required: true },
    priority: { type: Number, min: 0, max: 2, default: 0 },
    addedAt: { type: Date, default: () => new Date() },
    /** Never shown to friends or used in activity. */
    hiddenFromFriends: { type: Boolean, default: false },
  },
  { collection: "watchlist", versionKey: false },
);
WatchlistSchema.index({ uid: 1, mediaType: 1, tmdbId: 1 }, { unique: true });

export type WatchlistDoc = InferSchemaType<typeof WatchlistSchema> & { _id: unknown };
export const WatchlistItem: Model<WatchlistDoc> =
  (models.WatchlistItem as Model<WatchlistDoc>) ?? model<WatchlistDoc>("WatchlistItem", WatchlistSchema);

const CustomShelfSchema = new Schema(
  {
    uid: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    order: { type: Number, default: 0 },
  },
  { collection: "customShelves", timestamps: true, versionKey: false },
);

export type CustomShelfDoc = InferSchemaType<typeof CustomShelfSchema> & { _id: unknown };
export const CustomShelf: Model<CustomShelfDoc> =
  (models.CustomShelf as Model<CustomShelfDoc>) ?? model<CustomShelfDoc>("CustomShelf", CustomShelfSchema);
