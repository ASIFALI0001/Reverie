import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/route";
import { mintSessionCookie } from "@/lib/auth/session";
import { HINT_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_S } from "@/lib/auth/constants";

const secure = process.env.NODE_ENV === "production";

/** Exchange a fresh Firebase ID token for the httpOnly session cookie (+ a readable hint). */
export const POST = route(
  {
    input: z.object({ idToken: z.string().min(20) }),
    rateLimit: { name: "session", limit: 20, windowSec: 60 },
  },
  async ({ req, input }) => {
    const { cookie, uid } = await mintSessionCookie(input.idToken, req.cookies.get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ data: { uid } });
    const base = { path: "/", sameSite: "lax" as const, secure, maxAge: SESSION_MAX_AGE_S };
    res.cookies.set(SESSION_COOKIE, cookie, { ...base, httpOnly: true });
    res.cookies.set(HINT_COOKIE, String(Math.floor(Date.now() / 1000)), { ...base, httpOnly: false });
    return res;
  },
);

/** Sign out of this browser. (Other devices keep their sessions.) */
export const DELETE = route({}, async () => {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(HINT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
