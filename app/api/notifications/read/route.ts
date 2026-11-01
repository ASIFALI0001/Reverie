import { z } from "zod";
import { route } from "@/lib/http/route";
import { markNotificationsRead } from "@/lib/social/notifications";

/** PATCH /api/notifications/read — mark some (or, with no ids, all) notifications read. */
export const PATCH = route(
  {
    auth: "required",
    input: z.object({ ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(100).optional() }),
    rateLimit: { name: "notifications-write", limit: 60, windowSec: 60 },
  },
  async ({ user, input }) => markNotificationsRead(user.uid, input.ids),
);
