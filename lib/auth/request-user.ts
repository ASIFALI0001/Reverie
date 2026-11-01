import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { unauthorized } from "@/lib/http/errors";

export type AuthUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  /** Seconds since epoch of the last real sign-in (used to gate destructive actions). */
  authTime: number;
  provider: string | null;
  via: "bearer" | "cookie";
  /** The Firebase custom claim `admin: true` (set by `npm run make-admin`). Never read from Mongo. */
  admin: boolean;
};

function toUser(d: DecodedIdToken, via: AuthUser["via"]): AuthUser {
  return {
    uid: d.uid,
    email: d.email ?? null,
    name: (d.name as string | undefined) ?? null,
    picture: d.picture ?? null,
    authTime: d.auth_time,
    provider: d.firebase?.sign_in_provider ?? null,
    via,
    admin: d.admin === true,
  };
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * Resolve the caller. A Bearer Firebase ID token wins (the client sends one on
 * every API call); otherwise the httpOnly session cookie is accepted.
 * `checkRevoked` also asks Firebase whether the session was revoked (admin routes use it).
 */
export async function getRequestUser(req: Request, { checkRevoked = false } = {}): Promise<AuthUser | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      return toUser(await adminAuth().verifyIdToken(header.slice(7).trim(), checkRevoked), "bearer");
    } catch {
      throw unauthorized("Your session expired. Sign in again.", "invalid_token");
    }
  }
  return userFromSessionCookie(readCookie(req.headers.get("cookie"), SESSION_COOKIE), { checkRevoked });
}

/** The user behind a session cookie value, or null (also used by server components via cookies()). */
export async function userFromSessionCookie(cookie: string | undefined, { checkRevoked = false } = {}): Promise<AuthUser | null> {
  if (!cookie) return null;
  try {
    return toUser(await adminAuth().verifySessionCookie(cookie, checkRevoked), "cookie");
  } catch {
    return null;
  }
}
