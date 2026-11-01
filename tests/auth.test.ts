import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/constants";
import { readCookie } from "@/lib/auth/request-user";

describe("safeNext (open-redirect guard)", () => {
  it("allows same-site relative paths", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/title/movie/68721-iron-man-3?m=87")).toBe("/title/movie/68721-iron-man-3?m=87");
  });
  it("rejects anything that could leave the site", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    // Backslash variant (browsers treat "/" + backslash like "//"); built from a char code to keep the source unambiguous.
    expect(safeNext("/" + String.fromCharCode(92) + "evil.example")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("readCookie", () => {
  it("finds a cookie among many and decodes it", () => {
    expect(readCookie("a=1; rv_session=abc%3D%3D; b=2", "rv_session")).toBe("abc==");
  });
  it("does not match on prefixes", () => {
    expect(readCookie("rv_session_old=x", "rv_session")).toBeUndefined();
  });
  it("handles missing headers", () => {
    expect(readCookie(null, "rv_session")).toBeUndefined();
  });
});
