/** Pure helpers behind the admin panel (shared by the UI, the queries and the tests). */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The audit log's action filter: comma-separated actions, where one ending in "*" is a prefix.
 * "user.view*" → /^user\.view/; "user.block,user.unblock" → { $in: [...] }.
 */
export function auditActionFilter(action: string | undefined): string | RegExp | { $in: (string | RegExp)[] } | undefined {
  const one = (a: string) => (a.endsWith("*") ? new RegExp(`^${escapeRegex(a.slice(0, -1))}`) : a);
  const actions = (action ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  if (!actions.length) return undefined;
  return actions.length === 1 ? one(actions[0]!) : { $in: actions.map(one) };
}

const TAB_NAME: Record<string, string> = {
  taste: "Taste DNA",
  library: "library",
  watchlist: "watchlist",
  friends: "friends",
  activity: "activity",
};

/** user.view → "Opened the profile"; user.view.library → "Viewed their library". */
export function actionLabel(action: string): string {
  if (action === "user.view") return "Opened the profile";
  if (action.startsWith("user.view.")) {
    const tab = action.slice("user.view.".length);
    return `Viewed their ${TAB_NAME[tab] ?? tab}`;
  }
  switch (action) {
    case "user.block":
      return "Blocked the account";
    case "user.unblock":
      return "Unblocked the account";
    case "admin.grant":
      return "Made an administrator";
    case "admin.revoke":
      return "Removed as administrator";
    default:
      return action;
  }
}

export const isModerationAction = (action: string) => action === "user.block" || action === "user.unblock" || action.startsWith("admin.");

/** A clean axis maximum: 1, 2 or 5 × a power of ten, at least `max`. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= max) ?? 10 * pow;
}

export type BlockLength = "open" | "1d" | "7d" | "30d" | "date";

const DAY = 86_400_000;

/** When a block ends: null means "until an admin lifts it". A picked date ends at that day's last second, local time. */
export function blockUntil(length: BlockLength, date: string, now = Date.now()): string | null {
  switch (length) {
    case "open":
      return null;
    case "1d":
      return new Date(now + DAY).toISOString();
    case "7d":
      return new Date(now + 7 * DAY).toISOString();
    case "30d":
      return new Date(now + 30 * DAY).toISOString();
    case "date":
      return date ? new Date(`${date}T23:59:59`).toISOString() : null;
  }
}
