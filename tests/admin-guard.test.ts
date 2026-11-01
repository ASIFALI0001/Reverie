import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type FakeUser = { uid: string; admin: boolean; authTime: number; via: "bearer" | "cookie" };

const fake = vi.hoisted(() => ({
  user: null as FakeUser | null,
  blocked: new Set<string>(),
  checkRevoked: [] as boolean[],
}));

vi.mock("@/lib/auth/request-user", () => ({
  getRequestUser: async (_req: Request, opts?: { checkRevoked?: boolean }) => {
    fake.checkRevoked.push(Boolean(opts?.checkRevoked));
    return fake.user;
  },
}));

vi.mock("@/lib/auth/status", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/status")>();
  return {
    ...real,
    accountStatus: async (uid: string) =>
      fake.blocked.has(uid) ? { blocked: true, block: { reason: "spam", showReason: true, at: new Date(), until: null } } : { blocked: false },
  };
});

const { route } = await import("@/lib/http/route");
const { blockInForce } = await import("@/lib/auth/status");
const { requireRecentSignIn, RECENT_SIGN_IN_S } = await import("@/lib/admin/moderation");

const call = async (handler: ReturnType<typeof route>) => {
  const res = await handler(new NextRequest("http://localhost/api/x", { headers: { authorization: "Bearer t" } }), { params: Promise.resolve({}) });
  return { status: res.status, body: (await res.json()) as { data?: unknown; error?: { code: string } } };
};

const now = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  fake.user = null;
  fake.blocked.clear();
  fake.checkRevoked.length = 0;
});

describe("admin routes", () => {
  const adminOnly = route({ auth: "admin" }, () => ({ ok: true }));

  it("refuse signed-out callers and non-admins", async () => {
    expect((await call(adminOnly)).status).toBe(401);
    fake.user = { uid: "u1", admin: false, authTime: now(), via: "bearer" };
    const r = await call(adminOnly);
    expect(r.status).toBe(403);
    expect(r.body.error?.code).toBe("not_admin");
  });

  it("let admins in, and check their session for revocation", async () => {
    fake.user = { uid: "a1", admin: true, authTime: now(), via: "bearer" };
    const r = await call(adminOnly);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ ok: true });
    expect(fake.checkRevoked).toEqual([true]);
  });
});

describe("blocked accounts", () => {
  it("get ACCOUNT_BLOCKED from every route that knows who they are", async () => {
    fake.user = { uid: "b1", admin: false, authTime: now(), via: "bearer" };
    fake.blocked.add("b1");
    for (const handler of [route({ auth: "required" }, () => 1), route({ auth: "optional" }, () => 1)]) {
      const r = await call(handler);
      expect(r.status).toBe(403);
      expect(r.body.error?.code).toBe("ACCOUNT_BLOCKED");
    }
    // Public routes don't look the caller up at all.
    expect((await call(route({}, () => 1))).status).toBe(200);
  });

  it("can still read their own status", async () => {
    fake.user = { uid: "b1", admin: false, authTime: now(), via: "bearer" };
    fake.blocked.add("b1");
    expect((await call(route({ auth: "required", allowBlocked: true }, () => ({ blocked: true })))).status).toBe(200);
  });

  it("expire temporary blocks at their end date", () => {
    const at = new Date("2026-11-01T00:00:00Z");
    expect(blockInForce("blocked", null, at)).toBe(true);
    expect(blockInForce("blocked", new Date("2026-11-12T00:00:00Z"), at)).toBe(true);
    expect(blockInForce("blocked", new Date("2026-10-30T00:00:00Z"), at)).toBe(false);
    expect(blockInForce("active", null, at)).toBe(false);
  });
});

describe("sensitive admin actions", () => {
  it("need a sign-in within the last 30 minutes", () => {
    const t = 1_800_000_000_000;
    expect(() => requireRecentSignIn({ authTime: t / 1000 - 60 }, RECENT_SIGN_IN_S, t)).not.toThrow();
    expect(() => requireRecentSignIn({ authTime: t / 1000 - RECENT_SIGN_IN_S - 1 }, RECENT_SIGN_IN_S, t)).toThrow(/sign in again/);
  });
});
