/**
 * Where a user's data lives (plain module: account deletion and the e2e cleanup both use it).
 * Keep in sync with new models.
 */

/** Every collection that stores per-user rows keyed by `uid`. */
export const USER_KEYED_COLLECTIONS = [
  "tasteProfiles",
  "libraryItems",
  "watchlist",
  "customShelves",
  "matchCache",
  "homeCache",
  "searchHistory",
  "activity",
  "notifications",
  "moodSessions",
  "tasteSnapshots",
  "tasteTimelines",
  "tasteTwins",
  "whyNotFeedback",
  "seriesDecisions",
] as const;

/** Collections that link two users, and the fields that may hold either side. */
export const USER_PAIR_COLLECTIONS = [
  ["friendships", ["userA", "userB"]],
  ["userBlocks", ["blocker", "blocked"]],
  ["recommendations", ["fromUid", "toUid"]],
  ["twinConnects", ["from", "to"]],
] as const;
