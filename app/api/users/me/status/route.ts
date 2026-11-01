import { route } from "@/lib/http/route";
import { accountStatus } from "@/lib/auth/status";
import { env } from "@/lib/env";

/**
 * GET /api/users/me/status — the one route a blocked account can still call, for /blocked:
 * when, until when, the reason (only if the admin chose to show it) and where to appeal.
 */
export const GET = route(
  { auth: "required", allowBlocked: true, rateLimit: { name: "me-status", limit: 60, windowSec: 60 } },
  async ({ user }) => {
    const status = await accountStatus(user.uid);
    if (!status.blocked) return { blocked: false, supportEmail: env.supportEmail() };
    return {
      blocked: true,
      reason: status.block.showReason ? status.block.reason : null,
      at: status.block.at?.toISOString() ?? null,
      until: status.block.until ? new Date(status.block.until).toISOString() : null,
      supportEmail: env.supportEmail(),
    };
  },
);
