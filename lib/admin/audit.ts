import "server-only";
import type { NextRequest } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { AdminAuditLog } from "@/lib/db/models/Admin";
import { clientKey } from "@/lib/http/route";
import type { AuthUser } from "@/lib/auth/request-user";

/**
 * Record an admin action, or an admin opening someone's data. Awaited (not fire-and-forget):
 * if the log can't be written, the action doesn't happen.
 */
export async function audit(req: NextRequest, admin: AuthUser, action: string, targetUid: string | null, details: Record<string, unknown> = {}) {
  await connectDb();
  await AdminAuditLog.create({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action,
    targetUid,
    details,
    ip: clientKey(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
}
