import { ZodError } from "zod";

/** The one error shape every API route returns: { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, "bad_request", message, details);
export const unauthorized = (message = "Sign in to continue.", code = "unauthenticated") =>
  new ApiError(401, code, message);
export const forbidden = (message = "You don’t have access to this.", code = "forbidden") => new ApiError(403, code, message);
/** An administrator blocked this account. The client sends anyone who gets this to /blocked. */
export const ACCOUNT_BLOCKED = "ACCOUNT_BLOCKED";
export const accountBlocked = () => new ApiError(403, ACCOUNT_BLOCKED, "This account has been blocked by an administrator.");
export const notFound = (message = "Not found.") => new ApiError(404, "not_found", message);

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const headers: Record<string, string> = {};
    const retry = (err.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (err.status === 429 && retry) headers["Retry-After"] = String(retry);
    return Response.json(
      { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } },
      { status: err.status, headers },
    );
  }
  if (err instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "invalid_input",
          message: "Some of the request data isn’t valid.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", err);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong on our side. Try again in a moment." } },
    { status: 500 },
  );
}
