import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { AVATAR_TINTS, type AvatarTint } from "@/lib/avatar";

export { AVATAR_TINTS };

const UserSchema = new Schema(
  {
    _id: { type: String, required: true }, // Firebase uid
    email: { type: String, default: null },
    displayName: { type: String, default: null, maxlength: 80 },
    photoURL: { type: String, default: null },
    avatar: {
      kind: { type: String, enum: ["photo", "monogram"], default: "monogram" },
      tint: { type: String, enum: AVATAR_TINTS, default: "tungsten" },
    },
    region: { type: String, default: "IN", minlength: 2, maxlength: 2 },
    languages: { type: [String], default: ["en"] },
    onboardingDone: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: null },
    /** How the account was created ("password", "google.com"), from the first sign-in's token. */
    signUpMethod: { type: String, default: null },

    // ── Friends ──
    /** @handle: lowercase, unique (partial index in scripts/db-indexes.ts). Assigned on bootstrap, confirmed by the user. */
    handle: { type: String },
    /** False until the user has confirmed or picked their handle (the one-time modal). */
    handleChosen: { type: Boolean, default: false },
    /** Personal invite link code (unique). */
    inviteCode: { type: String },
    privacy: {
      /** What friends can see. */
      friendsSee: { type: String, enum: ["everything", "ratings", "nothing"], default: "ratings" },
      /** Take part in Taste Twins (anonymous until both connect). */
      inTwins: { type: Boolean, default: true },
      /** Findable by @handle / name in Find friends. */
      searchable: { type: Boolean, default: true },
    },
    /** Streaming services the user has (TMDB provider ids), for "only what's on my services". */
    services: { type: [Number], default: [] },
    /** Has seen the "compare with a friend?" invite moment. */
    invitePromptSeen: { type: Boolean, default: false },

    // ── Moderation ── (the admin role itself is a Firebase custom claim; this mirror is for display only)
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    block: {
      reason: { type: String, default: null },
      showReason: { type: Boolean, default: false },
      at: { type: Date, default: null },
      by: { type: String, default: null },
      /** Temporary blocks end here; checked at request time. */
      until: { type: Date, default: null },
    },
    blockHistory: {
      type: [
        {
          _id: false,
          action: { type: String, enum: ["block", "unblock"], required: true },
          reason: { type: String, default: null },
          by: { type: String, required: true },
          at: { type: Date, required: true },
          until: { type: Date, default: null },
        },
      ],
      default: [],
    },
  },
  { collection: "users", timestamps: true, versionKey: false },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string };

export const User: Model<UserDoc> = (models.User as Model<UserDoc>) ?? model<UserDoc>("User", UserSchema);

export type FriendsSee = "everything" | "ratings" | "nothing";
export type Privacy = { friendsSee: FriendsSee; inTwins: boolean; searchable: boolean };
export const DEFAULT_PRIVACY: Privacy = { friendsSee: "ratings", inTwins: true, searchable: true };

export function privacyOf(u: Pick<UserDoc, "privacy"> | null | undefined): Privacy {
  return {
    friendsSee: (u?.privacy?.friendsSee as FriendsSee | undefined) ?? DEFAULT_PRIVACY.friendsSee,
    inTwins: u?.privacy?.inTwins ?? DEFAULT_PRIVACY.inTwins,
    searchable: u?.privacy?.searchable ?? DEFAULT_PRIVACY.searchable,
  };
}

/** The shape the signed-in user sees about themselves — never includes anything it shouldn't. */
export function toPublicUser(u: UserDoc) {
  return {
    uid: u._id,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    avatar: {
      kind: (u.avatar?.kind ?? "monogram") as "photo" | "monogram",
      tint: (u.avatar?.tint ?? "tungsten") as AvatarTint,
    },
    region: u.region,
    languages: u.languages ?? ["en"],
    onboardingDone: Boolean(u.onboardingDone),
    handle: u.handle ?? null,
    handleChosen: Boolean(u.handleChosen),
    inviteCode: u.inviteCode ?? null,
    privacy: privacyOf(u),
    services: (u.services ?? []) as number[],
    invitePromptSeen: Boolean(u.invitePromptSeen),
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
