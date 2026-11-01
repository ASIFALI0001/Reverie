import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, errorResponse } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/rate-limit";

describe("errorResponse — one error shape everywhere", () => {
  it("serialises ApiError with its status and code", async () => {
    const res = errorResponse(new ApiError(404, "not_found", "No such title."));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "No such title." } });
  });
  it("adds Retry-After for rate limits", () => {
    const res = errorResponse(new ApiError(429, "rate_limited", "Slow down.", { retryAfter: 12 }));
    expect(res.headers.get("Retry-After")).toBe("12");
  });
  it("turns Zod errors into 400 invalid_input with field paths", async () => {
    const parsed = z.object({ region: z.string().length(2) }).safeParse({ region: "India" });
    const res = errorResponse(parsed.error);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.details[0].path).toBe("region");
  });
  it("never leaks internals for unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("connection string mongodb://user:pass@host"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("mongodb://");
  });
});

describe("in-memory rate limit", () => {
  it("allows up to the limit, then answers 429 with retryAfter", async () => {
    const rule = { name: `t-${Math.random()}`, limit: 3, windowSec: 60 };
    for (let i = 0; i < 3; i++) await enforceRateLimit(rule, "user-1");
    await expect(enforceRateLimit(rule, "user-1")).rejects.toMatchObject({ status: 429, code: "rate_limited" });
    // Other subjects have their own bucket.
    await expect(enforceRateLimit(rule, "user-2")).resolves.toBeUndefined();
  });
});
