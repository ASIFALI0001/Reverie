import { describe, expect, it } from "vitest";
import { clamp, formatCount, formatRuntime, slugify } from "@/lib/format";
import { warmth } from "@/lib/match-color";

describe("formatRuntime", () => {
  it("formats hours and minutes the way the hero meta line shows them", () => {
    expect(formatRuntime(130)).toBe("2h 10m");
    expect(formatRuntime(45)).toBe("45m");
    expect(formatRuntime(120)).toBe("2h");
  });
  it("returns null for missing or nonsense runtimes", () => {
    expect(formatRuntime(0)).toBeNull();
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(-5)).toBeNull();
  });
});

describe("formatCount", () => {
  it("abbreviates vote counts", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(1500)).toBe("1.5K");
    expect(formatCount(880_123)).toBe("880K");
    expect(formatCount(1_204_000)).toBe("1.2M");
    expect(formatCount(2_000_000)).toBe("2M");
  });
});

describe("slugify", () => {
  it("produces stable ASCII slugs", () => {
    expect(slugify("Iron Man 3")).toBe("iron-man-3");
    expect(slugify("Amélie")).toBe("amelie");
    expect(slugify("Fast & Furious")).toBe("fast-and-furious");
    expect(slugify("  Spider-Man: Into the Spider-Verse ")).toBe("spider-man-into-the-spider-verse");
  });
});

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(150, 1, 99)).toBe(99);
    expect(clamp(-3, 1, 99)).toBe(1);
  });
});

describe("match colour temperature", () => {
  it("is fully daylight for weak matches and fully tungsten for strong ones", () => {
    expect(warmth(20)).toBe(0);
    expect(warmth(95)).toBe(1);
  });
  it("warms monotonically as the score rises", () => {
    let prev = -1;
    for (let v = 0; v <= 100; v += 5) {
      const w = warmth(v);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });
});
