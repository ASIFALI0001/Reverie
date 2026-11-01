import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const DAY = 86_400;

/** One document per pair of users, with the two uids in sorted order so the pair is unique. */
export function pairOf(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

// ── Friendships ─────────────────────────────────────────────────────────────

const FriendshipSchema = new Schema(
  {
    userA: { type: String, required: true },
    userB: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted"], required: true },
    requestedBy: { type: String, required: true },
    /** How the request started. */
    via: { type: String, enum: ["invite", "search", "profile", "twins"], default: "search" },
    createdAt: { type: Date, default: () => new Date() },
    acceptedAt: { type: Date, default: null },
  },
  { collection: "friendships", versionKey: false },
);
FriendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });
FriendshipSchema.index({ userA: 1, status: 1 });
FriendshipSchema.index({ userB: 1, status: 1 });

export type FriendshipDoc = InferSchemaType<typeof FriendshipSchema> & { _id: unknown };
export const Friendship: Model<FriendshipDoc> =
  (models.Friendship as Model<FriendshipDoc>) ?? model<FriendshipDoc>("Friendship", FriendshipSchema);

// ── Blocks between users (not admin blocks) ─────────────────────────────────

const UserBlockSchema = new Schema(
  {
    blocker: { type: String, required: true },
    blocked: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "userBlocks", versionKey: false },
);
UserBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
UserBlockSchema.index({ blocked: 1 });

export type UserBlockDoc = InferSchemaType<typeof UserBlockSchema> & { _id: unknown };
export const UserBlock: Model<UserBlockDoc> = (models.UserBlock as Model<UserBlockDoc>) ?? model<UserBlockDoc>("UserBlock", UserBlockSchema);

// ── "Send to a friend" ──────────────────────────────────────────────────────

export const RECOMMENDATION_REACTIONS = ["watchlisted", "watched", "not-for-me"] as const;

const RecommendationSchema = new Schema(
  {
    fromUid: { type: String, required: true },
    toUid: { type: String, required: true },
    key: { type: String, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    tmdbId: { type: Number, required: true },
    note: { type: String, maxlength: 280, default: "" },
    reaction: {
      type: {
        _id: false,
        kind: { type: String, enum: RECOMMENDATION_REACTIONS, required: true },
        rating: { type: Number, min: 1, max: 10, default: null },
        at: { type: Date, required: true },
      },
      default: null,
    },
    createdAt: { type: Date, default: () => new Date() },
    seenAt: { type: Date, default: null },
  },
  { collection: "recommendations", versionKey: false },
);
RecommendationSchema.index({ toUid: 1, createdAt: -1 });
RecommendationSchema.index({ fromUid: 1, createdAt: -1 });

export type RecommendationDoc = InferSchemaType<typeof RecommendationSchema> & { _id: unknown };
export const Recommendation: Model<RecommendationDoc> =
  (models.Recommendation as Model<RecommendationDoc>) ?? model<RecommendationDoc>("Recommendation", RecommendationSchema);

// ── Shared watchlists ───────────────────────────────────────────────────────

const SharedListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    ownerUid: { type: String, required: true },
    /** Everyone on the list, owner included. */
    memberUids: { type: [String], required: true },
    items: {
      type: [
        {
          _id: false,
          key: { type: String, required: true },
          mediaType: { type: String, enum: ["movie", "tv"], required: true },
          tmdbId: { type: Number, required: true },
          addedBy: { type: String, required: true },
          addedAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },
  },
  { collection: "sharedLists", timestamps: true, versionKey: false },
);
SharedListSchema.index({ memberUids: 1, updatedAt: -1 });

export type SharedListDoc = InferSchemaType<typeof SharedListSchema> & { _id: unknown };
export const SharedList: Model<SharedListDoc> = (models.SharedList as Model<SharedListDoc>) ?? model<SharedListDoc>("SharedList", SharedListSchema);

// ── Activity (what friends see in the strip) ────────────────────────────────

export const ACTIVITY_TYPES = ["watched", "rated", "started", "watchlisted"] as const;

const ActivitySchema = new Schema(
  {
    uid: { type: String, required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    key: { type: String, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    tmdbId: { type: Number, required: true },
    rating: { type: Number, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "activity", versionKey: false },
);
ActivitySchema.index({ uid: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * DAY });

export type ActivityDoc = InferSchemaType<typeof ActivitySchema> & { _id: unknown };
export const Activity: Model<ActivityDoc> = (models.Activity as Model<ActivityDoc>) ?? model<ActivityDoc>("Activity", ActivitySchema);

// ── Notifications ───────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "friend_request",
  "friend_accepted",
  "recommendation",
  "recommendation_reaction",
  "twin_connect",
  "shared_list_invite",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NotificationSchema = new Schema(
  {
    uid: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    /** Who it's from, if anyone (shown as an avatar; resolved at read time so privacy changes apply). */
    actorUid: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "notifications", versionKey: false },
);
NotificationSchema.index({ uid: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * DAY });

export type NotificationDoc = InferSchemaType<typeof NotificationSchema> & { _id: unknown };
export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ?? model<NotificationDoc>("Notification", NotificationSchema);

// ── Taste Twins: "Connect" taps (mutual = friends) ──────────────────────────

const TwinConnectSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "twinConnects", versionKey: false },
);
TwinConnectSchema.index({ from: 1, to: 1 }, { unique: true });
TwinConnectSchema.index({ to: 1 });

export type TwinConnectDoc = InferSchemaType<typeof TwinConnectSchema> & { _id: unknown };
export const TwinConnect: Model<TwinConnectDoc> =
  (models.TwinConnect as Model<TwinConnectDoc>) ?? model<TwinConnectDoc>("TwinConnect", TwinConnectSchema);
