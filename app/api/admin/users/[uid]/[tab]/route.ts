import { z } from "zod";
import { route } from "@/lib/http/route";
import { audit } from "@/lib/admin/audit";
import { adminUserActivity, adminUserFriends, adminUserLibrary, adminUserTaste, adminUserWatchlist, listAudit } from "@/lib/admin/queries";

const Input = z.object({
  uid: z.string().min(1).max(128),
  tab: z.enum(["taste", "library", "watchlist", "friends", "activity", "audit"]),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

/**
 * GET /api/admin/users/:uid/:tab — one tab of a user's detail page. Reading their private data
 * is audited ("user.view.library", …); the audit-log tab is the admins' own record, so it isn't.
 */
export const GET = route({ auth: "admin", input: Input, rateLimit: { name: "admin-read", limit: 240, windowSec: 60 } }, async ({ req, user, input }) => {
  if (input.tab === "audit") return listAudit({ target: input.uid, page: input.page });
  await audit(req, user, `user.view.${input.tab}`, input.uid);
  switch (input.tab) {
    case "taste":
      return adminUserTaste(input.uid);
    case "library":
      return adminUserLibrary(input.uid);
    case "watchlist":
      return { items: await adminUserWatchlist(input.uid) };
    case "friends":
      return adminUserFriends(input.uid);
    case "activity":
      return adminUserActivity(input.uid);
  }
});
