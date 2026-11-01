import { describe, expect, it } from "vitest";
import { actionLabel, auditActionFilter, blockUntil, isModerationAction, niceMax } from "@/lib/admin/format";

describe("auditActionFilter", () => {
  it("passes an exact action through", () => {
    expect(auditActionFilter("user.block")).toBe("user.block");
  });
  it("turns a trailing * into an anchored prefix", () => {
    const re = auditActionFilter("user.view*") as RegExp;
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test("user.view")).toBe(true);
    expect(re.test("user.view.library")).toBe(true);
    expect(re.test("xuser.view")).toBe(false);
    // The dot is literal, not "any character".
    expect(re.test("userXview")).toBe(false);
  });
  it("matches any of a comma-separated list", () => {
    expect(auditActionFilter("user.block, user.unblock")).toEqual({ $in: ["user.block", "user.unblock"] });
  });
  it("ignores empty input", () => {
    expect(auditActionFilter(undefined)).toBeUndefined();
    expect(auditActionFilter(" , ")).toBeUndefined();
  });
});

describe("actionLabel", () => {
  it("names views and moderation in plain words", () => {
    expect(actionLabel("user.view")).toBe("Opened the profile");
    expect(actionLabel("user.view.library")).toBe("Viewed their library");
    expect(actionLabel("user.view.taste")).toBe("Viewed their Taste DNA");
    expect(actionLabel("user.block")).toBe("Blocked the account");
    expect(actionLabel("admin.grant")).toBe("Made an administrator");
    expect(actionLabel("something.new")).toBe("something.new");
  });
  it("marks moderation, not views, as moderation", () => {
    expect(isModerationAction("user.unblock")).toBe(true);
    expect(isModerationAction("admin.revoke")).toBe(true);
    expect(isModerationAction("user.view.friends")).toBe(false);
  });
});

describe("niceMax", () => {
  it("rounds up to 1, 2 or 5 × a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(12)).toBe(20);
    expect(niceMax(480)).toBe(500);
    expect(niceMax(501)).toBe(1000);
  });
});

describe("blockUntil", () => {
  const now = Date.UTC(2026, 9, 26, 12, 0, 0);
  it("leaves an open-ended block without an end", () => {
    expect(blockUntil("open", "", now)).toBeNull();
  });
  it("counts fixed lengths from now", () => {
    expect(blockUntil("1d", "", now)).toBe(new Date(now + 86_400_000).toISOString());
    expect(blockUntil("30d", "", now)).toBe(new Date(now + 30 * 86_400_000).toISOString());
  });
  it("ends a picked date at its last second, local time", () => {
    const iso = blockUntil("date", "2026-11-03", now)!;
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 3, 23, 59]);
    expect(blockUntil("date", "", now)).toBeNull();
  });
});
