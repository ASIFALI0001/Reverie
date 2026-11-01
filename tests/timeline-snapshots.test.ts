import { describe, expect, it } from "vitest";
import { buildSnapshots, hashInputs, itemWeight, monthStart, type SnapshotItem } from "@/lib/timeline/snapshots";
import type { TitleKey } from "@/lib/catalog/types";

const item = (over: Omit<Partial<SnapshotItem>, "key" | "at"> & { key: string; at: string }): SnapshotItem => ({
  status: "watched",
  rating: null,
  title: over.key,
  posterPath: null,
  genres: ["Drama"],
  vibe: null,
  minutes: 120,
  embedding: null,
  ...over,
  key: over.key as TitleKey,
  at: new Date(over.at),
});

describe("taste snapshots", () => {
  it("buckets by UTC month, oldest first", () => {
    expect(monthStart(new Date("2026-03-31T23:30:00Z")).toISOString()).toBe("2026-03-01T00:00:00.000Z");
    const snaps = buildSnapshots([
      item({ key: "movie:2", at: "2026-04-02T10:00:00Z" }),
      item({ key: "movie:1", at: "2026-03-15T10:00:00Z" }),
      item({ key: "movie:3", at: "2026-04-20T10:00:00Z" }),
    ]);
    expect(snaps.map((s) => [s.periodStart.toISOString().slice(0, 7), s.count])).toEqual([
      ["2026-03", 1],
      ["2026-04", 2],
    ]);
    expect(snaps[0]!.periodEnd.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("splits each title's genre vote, so shares sum to 1", () => {
    const [s] = buildSnapshots([
      item({ key: "movie:1", at: "2026-05-01T00:00:00Z", genres: ["Action", "Science Fiction"] }),
      item({ key: "movie:2", at: "2026-05-03T00:00:00Z", genres: ["Action"] }),
    ]);
    const total = s!.genreShare.reduce((a, g) => a + g.value, 0);
    expect(total).toBeCloseTo(1, 2);
    expect(s!.genreShare[0]).toEqual({ term: "Action", value: 0.75 });
  });

  it("scores genres with the profile's weights: loved up, disliked and dropped down", () => {
    const [s] = buildSnapshots([
      item({ key: "movie:1", at: "2026-06-01T00:00:00Z", genres: ["Horror"], rating: 9 }),
      item({ key: "movie:2", at: "2026-06-02T00:00:00Z", genres: ["Horror"], rating: 10 }),
      item({ key: "movie:3", at: "2026-06-03T00:00:00Z", genres: ["Romance"], rating: 3 }),
      item({ key: "movie:4", at: "2026-06-04T00:00:00Z", genres: ["Romance"], status: "dropped" }),
    ]);
    const aff = Object.fromEntries(s!.genreAffinity.map((g) => [g.term, g.value]));
    expect(aff.Horror).toBeGreaterThan(0.5);
    expect(aff.Romance).toBeLessThan(-0.4);
    expect(s!.avgRating).toBeCloseTo(7.33, 2);
    expect(itemWeight({ status: "watching", rating: null })).toBeGreaterThan(0);
  });

  it("leads with the best-rated titles, and counts hours only for what was finished", () => {
    const [s] = buildSnapshots([
      item({ key: "movie:1", at: "2026-07-01T00:00:00Z", rating: 6 }),
      item({ key: "movie:2", at: "2026-07-02T00:00:00Z", rating: 10 }),
      item({ key: "movie:3", at: "2026-07-03T00:00:00Z", rating: 8, minutes: 90 }),
    ]);
    expect(s!.topTitles.map((t) => t.key)).toEqual(["movie:2", "movie:3", "movie:1"]);
    expect(s!.hours).toBeCloseTo(5.5, 1);
  });

  it("averages vibe and direction toward what they liked", () => {
    const [s] = buildSnapshots([
      item({ key: "movie:1", at: "2026-08-01T00:00:00Z", rating: 10, vibe: { pace: 0.9, tone: 0.2, complexity: 0.5 }, embedding: [1, 0, 0] }),
      item({ key: "movie:2", at: "2026-08-02T00:00:00Z", rating: 2, vibe: { pace: 0.1, tone: 0.9, complexity: 0.5 }, embedding: [0, 1, 0] }),
    ]);
    expect(s!.vibe!.pace).toBeGreaterThan(0.75);
    expect(s!.vector![0]).toBeGreaterThan(s!.vector![1]!);
    expect(Math.hypot(...s!.vector!)).toBeCloseTo(1, 3);
  });

  it("fingerprints a month's inputs independently of order", () => {
    const a = hashInputs([
      { key: "movie:1" as TitleKey, status: "watched", rating: 8 },
      { key: "tv:2" as TitleKey, status: "watching", rating: null },
    ]);
    const b = hashInputs([
      { key: "tv:2" as TitleKey, status: "watching", rating: null },
      { key: "movie:1" as TitleKey, status: "watched", rating: 8 },
    ]);
    expect(a).toBe(b);
    expect(hashInputs([{ key: "movie:1" as TitleKey, status: "watched", rating: 9 }])).not.toBe(
      hashInputs([{ key: "movie:1" as TitleKey, status: "watched", rating: 8 }]),
    );
  });
});
