import { describe, expect, it } from "vitest";
import { detectEras, ERA_RULES, fallbackEraLine, fallbackEraName, genreSeries, type MonthInput } from "@/lib/timeline/eras";
import type { TermValue } from "@/lib/timeline/snapshots";
import type { TitleKey } from "@/lib/catalog/types";

// Monthly genre mixes, as snapshots store them (shares sum to 1).
const SCIFI: TermValue[] = [
  { term: "Science Fiction", value: 0.5 },
  { term: "Thriller", value: 0.3 },
  { term: "Action", value: 0.2 },
];
const SCIFI_2: TermValue[] = [
  { term: "Science Fiction", value: 0.45 },
  { term: "Thriller", value: 0.25 },
  { term: "Action", value: 0.2 },
  { term: "Drama", value: 0.1 },
];
const HORROR: TermValue[] = [
  { term: "Horror", value: 0.6 },
  { term: "Thriller", value: 0.25 },
  { term: "Mystery", value: 0.15 },
];
const ROMCOM: TermValue[] = [
  { term: "Romance", value: 0.5 },
  { term: "Comedy", value: 0.4 },
  { term: "Drama", value: 0.1 },
];

let n = 0;
function month(i: number, genreShare: TermValue[], over: Partial<MonthInput> = {}): MonthInput {
  return {
    periodStart: new Date(Date.UTC(2026, i, 1)),
    periodEnd: new Date(Date.UTC(2026, i + 1, 1)),
    count: 6,
    hours: 12,
    avgRating: 8,
    genreShare,
    genreAffinity: genreShare.map((g) => ({ term: g.term, value: 0.5 })),
    vibe: { pace: 0.5, tone: 0.5, complexity: 0.5 },
    topTitles: [],
    hash: `h${n++}`,
    ...over,
  };
}
const year = (...mixes: TermValue[][]) => mixes.map((m, i) => month(i, m));
const spans = (eras: ReturnType<typeof detectEras>) => eras.map((e) => `${e.start.toISOString().slice(0, 7)}→${e.months}`);

describe("taste eras", () => {
  it("a steady taste is one era", () => {
    const eras = detectEras(year(SCIFI, SCIFI_2, SCIFI, SCIFI_2));
    expect(spans(eras)).toEqual(["2026-01→4"]);
    expect(eras[0]!.shift).toBeNull();
    expect(eras[0]!.end.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("a clear turn starts a new era, and says how much of the mix changed", () => {
    const eras = detectEras(year(SCIFI, SCIFI_2, SCIFI, HORROR, HORROR));
    expect(spans(eras)).toEqual(["2026-01→3", "2026-04→2"]);
    expect(eras[1]!.shift).toBeGreaterThan(0.5);
    expect(eras[1]!.genres[0]).toEqual({ term: "Horror", value: 0.6 });
  });

  it("one odd month in the middle is folded in", () => {
    expect(spans(detectEras(year(SCIFI, SCIFI, HORROR, SCIFI, SCIFI)))).toEqual(["2026-01→5"]);
  });

  it("an odd latest month waits for a second before it's an era, and never drags a neighbour along", () => {
    expect(spans(detectEras(year(SCIFI, SCIFI, SCIFI, HORROR)))).toEqual(["2026-01→4"]);
    expect(spans(detectEras(year(SCIFI, SCIFI, SCIFI, HORROR, HORROR)))).toEqual(["2026-01→3", "2026-04→2"]);
  });

  it("returning to an old taste is its own era (it's part of the story)", () => {
    expect(spans(detectEras(year(SCIFI, SCIFI, HORROR, HORROR, SCIFI, SCIFI)))).toEqual(["2026-01→2", "2026-03→2", "2026-05→2"]);
  });

  it("a one-title month of something else doesn't move anything", () => {
    const eras = detectEras([month(0, SCIFI), month(1, SCIFI), month(2, HORROR, { count: 1 }), month(3, SCIFI), month(4, SCIFI)]);
    expect(spans(eras)).toEqual(["2026-01→5"]);
  });

  it("a month with nothing catalogued carries no weight", () => {
    const eras = detectEras([month(0, SCIFI), month(1, SCIFI), month(2, []), month(3, HORROR), month(4, HORROR)]);
    expect(eras.length).toBe(2);
    expect(eras.reduce((a, e) => a + e.months, 0)).toBe(5);
  });

  it("past the cap, the history is told in fewer, broader eras", () => {
    const mixes = [SCIFI, HORROR, ROMCOM, SCIFI, HORROR, ROMCOM, SCIFI, HORROR].flatMap((m) => [m, m]);
    expect(detectEras(year(...mixes)).length).toBe(8);
    const capped = detectEras(year(...mixes), { ...ERA_RULES, maxEras: 3 });
    expect(capped.length).toBe(3);
    expect(capped.reduce((a, e) => a + e.months, 0)).toBe(16);
  });

  it("sums an era: count-weighted genres, rating and vibe; best titles once each", () => {
    const t = (key: string, rating: number | null) => ({ key: key as TitleKey, title: key, posterPath: null, rating });
    const [era] = detectEras([
      month(0, [{ term: "Horror", value: 1 }], {
        count: 1,
        avgRating: 6,
        genreAffinity: [{ term: "Horror", value: -0.4 }],
        vibe: { pace: 0.2, tone: 0.9, complexity: 0.5 },
        topTitles: [t("movie:1", 6)],
      }),
      month(
        1,
        [
          { term: "Science Fiction", value: 0.5 },
          { term: "Horror", value: 0.5 },
        ],
        {
          count: 3,
          avgRating: 10,
          genreAffinity: [
            { term: "Science Fiction", value: 0.8 },
            { term: "Horror", value: 0.4 },
          ],
          vibe: { pace: 0.6, tone: 0.5, complexity: 0.5 },
          topTitles: [t("movie:2", 10), t("movie:1", 6)],
        },
      ),
    ]);
    expect(era!.count).toBe(4);
    expect(era!.avgRating).toBe(9); // (6·1 + 10·3) / 4
    expect(era!.genres).toEqual([
      { term: "Horror", value: 0.625 }, // (1·1 + 0.5·3) / 4
      { term: "Science Fiction", value: 0.375 },
    ]);
    expect(era!.vibe).toEqual({ pace: 0.5, tone: 0.6, complexity: 0.5 });
    expect(era!.topTitles.map((x) => x.key)).toEqual(["movie:2", "movie:1"]);
    // Horror's affinity: (−0.4·1 + 0.4·1.5) / 2.5 = 0.08 → radar (0.08 + 1) / 2 = 0.54.
    expect(era!.radar.find((p) => p.axis === "Horror")!.value).toBe(0.54);
  });

  it("an era's fingerprint changes only when its months do", () => {
    const a = detectEras([month(0, SCIFI, { hash: "x" }), month(1, SCIFI, { hash: "y" })]);
    const b = detectEras([month(0, SCIFI, { hash: "x" }), month(1, SCIFI, { hash: "y" })]);
    const c = detectEras([month(0, SCIFI, { hash: "x" }), month(1, SCIFI, { hash: "z" })]);
    expect(a[0]!.hash).toBe(b[0]!.hash);
    expect(a[0]!.hash).not.toBe(c[0]!.hash);
  });
});

describe("genre share over time", () => {
  it("keeps the top genres, adds Other, and leaves empty months as gaps", () => {
    const { genres, months } = genreSeries(
      [
        month(0, [
          { term: "Drama", value: 0.75 },
          { term: "Comedy", value: 0.25 },
        ]),
        month(2, [
          { term: "Comedy", value: 0.5 },
          { term: "Horror", value: 0.3 },
          { term: "Drama", value: 0.2 },
        ]),
      ],
      2,
    );
    expect(genres).toEqual(["Drama", "Comedy"]);
    expect(months.map((m) => [m.start.toISOString().slice(0, 7), m.shares])).toEqual([
      ["2026-01", [0.75, 0.25, 0]],
      ["2026-02", null],
      ["2026-03", [0.2, 0.5, 0.3]],
    ]);
  });
});

describe("era words without the model", () => {
  it("names a phase by its two biggest genres", () => {
    expect(
      fallbackEraName({
        genres: [
          { term: "Science Fiction", value: 0.5 },
          { term: "Thriller", value: 0.3 },
        ],
      }),
    ).toBe("Sci-fi and thriller phase");
    expect(
      fallbackEraName({
        genres: [
          { term: "Science Fiction", value: 0.5 },
          { term: "Sci-Fi & Fantasy", value: 0.3 },
          { term: "Drama", value: 0.2 },
        ],
      }),
    ).toBe("Sci-fi and drama phase");
    expect(fallbackEraName({ genres: [] })).toBe("A quiet phase");
  });

  it("describes it in one plain line", () => {
    expect(
      fallbackEraLine({
        count: 12,
        months: 3,
        genres: [
          { term: "Crime", value: 0.4 },
          { term: "Drama", value: 0.3 },
        ],
        vibe: { pace: 0.3, tone: 0.8, complexity: 0.5 },
      }),
    ).toBe("12 titles over 3 months, mostly crime and drama, leaning slow and dark.");
    expect(fallbackEraLine({ count: 1, months: 1, genres: [], vibe: null })).toBe("1 title over 1 month.");
  });
});
