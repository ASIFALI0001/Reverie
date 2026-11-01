import { describe, expect, it } from "vitest";
import { handleCandidates, handleProblem, isValidHandle, normalizeHandle, suggestHandleBase } from "@/lib/social/handles";
import { INVITE_CODE_RE, newInviteCode } from "@/lib/social/invite";

describe("handles", () => {
  it("normalizes input from a form", () => {
    expect(normalizeHandle("  @Asif.A ")).toBe("asif.a");
    expect(normalizeHandle("@@Night_Owl")).toBe("night_owl");
  });

  it("explains every rule in words", () => {
    expect(handleProblem("ab")).toMatch(/At least 3/);
    expect(handleProblem("a".repeat(21))).toMatch(/At most 20/);
    expect(handleProblem("has space")).toMatch(/Letters, numbers/);
    expect(handleProblem("emoji🙂")).toMatch(/Letters, numbers/);
    expect(handleProblem(".dot")).toMatch(/start or end with a dot/);
    expect(handleProblem("dot.")).toMatch(/start or end with a dot/);
    expect(handleProblem("dou..ble")).toMatch(/double dots/);
    expect(handleProblem("admin")).toMatch(/reserved/);
    expect(handleProblem("settings")).toMatch(/reserved/);
    expect(handleProblem("asif.ahmed_99")).toBeNull();
    expect(isValidHandle("_under_")).toBe(true);
  });

  it("suggests a valid handle from a name or email", () => {
    expect(suggestHandleBase("Asif Ahmed", "x@y.z")).toBe("asifahmed");
    expect(suggestHandleBase("Zoë Saldaña", null)).toBe("zoesaldana");
    expect(suggestHandleBase(null, "night.owl@example.com")).toBe("night.owl");
    expect(suggestHandleBase("Al", null)).toBe("al_rv");
    expect(suggestHandleBase("", "")).toBe("viewer_rv");
    expect(suggestHandleBase("Admin", null)).toBe("admin_rv");
    expect(suggestHandleBase("A Very Long Name Indeed Quite Long", null).length).toBeLessThanOrEqual(16);
    for (const s of ["Asif Ahmed", "Zoë", "...", "ab", "admin", "x".repeat(40)]) expect(isValidHandle(suggestHandleBase(s, null))).toBe(true);
  });

  it("offers the base first, then valid numbered variants", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const c = handleCandidates("asifahmed", 6, random);
    expect(c[0]).toBe("asifahmed");
    expect(c.length).toBeGreaterThan(3);
    for (const h of c) expect(isValidHandle(h)).toBe(true);
    for (const h of handleCandidates("x".repeat(20), 4, random)) expect(h.length).toBeLessThanOrEqual(20);
  });
});

describe("invite codes", () => {
  it("are 10 easy-to-read characters, and don't repeat", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => newInviteCode()));
    expect(codes.size).toBe(2000);
    for (const c of [...codes].slice(0, 50)) {
      expect(c).toMatch(INVITE_CODE_RE);
      expect(c).not.toMatch(/[01ilo]/);
    }
  });
});
