import { route } from "@/lib/http/route";
import { clearSearches, recentSearches } from "@/lib/reco/ask";

/** GET /api/search/recent — the viewer's last few Ask searches. DELETE clears them. */
export const GET = route({ auth: "required" }, async ({ user }) => ({ queries: await recentSearches(user.uid) }));

export const DELETE = route({ auth: "required" }, async ({ user }) => {
  await clearSearches(user.uid);
  return { cleared: true };
});
