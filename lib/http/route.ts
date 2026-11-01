import "server-only";
import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { getRequestUser, type AuthUser } from "@/lib/auth/request-user";
import { accountStatus } from "@/lib/auth/status";
import { accountBlocked, ApiError, badRequest, errorResponse, forbidden, unauthorized } from "@/lib/http/errors";
import { enforceRateLimit, type RateRule } from "@/lib/rate-limit";

/** "admin" = a verified admin custom claim, with the session checked for revocation. */
type AuthMode = "required" | "optional" | "none" | "admin";

type Ctx<A extends AuthMode, I> = {
  req: NextRequest;
  input: I;
  user: A extends "required" | "admin" ? AuthUser : AuthUser | null;
  params: Record<string, string>;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Cookie-authenticated writes must come from our own origin (CSRF guard). */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new ApiError(403, "cross_site", "Cross-site request blocked.");
  if (origin && origin !== req.nextUrl.origin) throw new ApiError(403, "cross_site", "Cross-site request blocked.");
}

export function clientKey(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "anon";
}

async function readInput(req: NextRequest, params: Record<string, string>) {
  if (SAFE_METHODS.has(req.method) || req.method === "DELETE") {
    const query = Object.fromEntries(req.nextUrl.searchParams.entries());
    return { ...query, ...params };
  }
  const text = await req.text();
  if (!text) return { ...params };
  try {
    return { ...JSON.parse(text), ...params };
  } catch {
    throw badRequest("The request body isn’t valid JSON.");
  }
}

/**
 * Wrap a route handler with auth, input validation, rate limiting and the
 * shared error format. Returning a plain value sends `{ data: value }`.
 * Any request that identifies a user is refused with ACCOUNT_BLOCKED while an
 * administrator's block is in force, unless the route sets `allowBlocked`.
 */
export function route<A extends AuthMode = "none", S extends z.ZodType = z.ZodType<undefined>>(
  opts: { auth?: A; input?: S; rateLimit?: RateRule; allowBlocked?: boolean },
  handler: (ctx: Ctx<A, z.infer<S>>) => Promise<unknown> | unknown,
) {
  return async (req: NextRequest, segment: { params: Promise<Record<string, string | string[] | undefined>> }) => {
    try {
      const rawParams = (await segment?.params) ?? {};
      const params = Object.fromEntries(
        Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : (v ?? "")]),
      );

      const mode = opts.auth ?? "none";
      const user = mode === "none" ? null : await getRequestUser(req, { checkRevoked: mode === "admin" });
      if ((mode === "required" || mode === "admin") && !user) throw unauthorized();
      if (mode === "admin" && !user!.admin) throw forbidden("This area is for administrators.", "not_admin");
      if (user && !opts.allowBlocked && (await accountStatus(user.uid)).blocked) throw accountBlocked();
      if (user?.via === "cookie" && !SAFE_METHODS.has(req.method)) assertSameOrigin(req);

      if (opts.rateLimit) await enforceRateLimit(opts.rateLimit, user?.uid ?? clientKey(req));

      const input = opts.input ? opts.input.parse(await readInput(req, params)) : undefined;
      const result = await handler({ req, input, user, params } as Ctx<A, z.infer<S>>);
      if (result instanceof Response) return result;
      return Response.json({ data: result ?? null });
    } catch (err) {
      // Prerender bail-outs, redirect() and notFound() are Next control flow, not failures.
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}
