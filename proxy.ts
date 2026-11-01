import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Optimistic routing only: a session cookie's *presence* decides where to send
 * the visitor. Real verification happens in API routes (ID token / session cookie).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = req.cookies.has(SESSION_COOKIE);

  // One URL, two pages: the static landing for visitors, the personal feed for members.
  if (pathname === "/") {
    return signedIn ? NextResponse.rewrite(new URL("/home", req.url)) : NextResponse.next();
  }
  if (pathname === "/home" && !signedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // The admin area has its own sign-in (which checks the role); the server gate checks again.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !signedIn) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home", "/library/:path*", "/watchlist", "/onboarding", "/settings", "/friends", "/u/:path*", "/lists/:path*", "/mood", "/taste/:path*", "/admin/:path*"],
};
