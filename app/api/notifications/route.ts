import { route } from "@/lib/http/route";
import { listNotifications } from "@/lib/social/notifications";

/** GET /api/notifications — the bell: newest first, with the unread count. */
export const GET = route({ auth: "required", rateLimit: { name: "notifications-read", limit: 120, windowSec: 60 } }, async ({ user }) =>
  listNotifications(user.uid),
);
