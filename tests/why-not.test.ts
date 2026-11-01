import { describe, expect, it } from "vitest";
import { fallbackWhyNot, median, mismatches, sanitizeWhyNot, tidyReason, type EvidenceTitle, type MismatchInput } from "@/lib/reco/why-not";
import { mergeSignals, WEIGHTS } from "@/lib/reco/weights";
import type { TitleKey } from "@/lib/catalog/types";

const base: MismatchInput = {
  target: { mediaType: "movie", runtime: 110, genres: ["Drama"], year: 2019, language: "en", vibe: { pace: 0.5, tone: 0.5, complexity: 0.5 } },
  vibe: { pace: 0.5, tone: 0.5, complexity: 0.5 },
  genreAffinity: [],
  usualRuntime: 112,
  meanYear: 2015,
  avoidsSubtitles: false,
  languages: ["en"],
};

describe("why-not mismatch facts", () => {
  it("finds nothing when the title fits the viewer", () => {
    expect(mismatches(base)).toEqual([]);
  });

  it("flags a film well past the length of the ones they finish", () => {
    const [m] = mismatches({ ...base, target: { ...base.target, runtime: 160 } });
    expect(m).toMatchObject({ kind: "runtime", fact: "It runs 2h 40m; the films you finish usually run about 1h 50m." });
    // Series lengths aren't compared, and a modest overrun isn't worth a reason.
    expect(mismatches({ ...base, target: { ...base.target, mediaType: "tv", runtime: 160 } })).toEqual([]);
    expect(mismatches({ ...base, target: { ...base.target, runtime: 135 } })).toEqual([]);
  });

  it("reads pace, tone and depth gaps in plain words, strongest first", () => {
    const facts = mismatches({ ...base, target: { ...base.target, vibe: { pace: 0.1, tone: 0.9, complexity: 0.5 } }, vibe: { pace: 0.75, tone: 0.3, complexity: 0.5 } });
    expect(facts.map((f) => f.kind)).toEqual(["pace", "tone"]);
    expect(facts[0]!.fact).toBe("It’s a slow burn, and you lean toward faster-moving stories.");
    expect(facts[1]!.fact).toBe("It’s dark and heavy, and you usually go for lighter stories.");
  });

  it("names a genre they rate low, but only with enough evidence", () => {
    const romance = { ...base, target: { ...base.target, genres: ["Romance", "Drama"] } };
    expect(mismatches({ ...romance, genreAffinity: [{ term: "Romance", value: -0.4, n: 5 }] })[0]!.fact).toBe("You usually rate romance lower than most things you watch.");
    expect(mismatches({ ...romance, genreAffinity: [{ term: "Romance", value: -0.4, n: 1 }] })).toEqual([]);
  });

  it("mentions the era and subtitles when they apply", () => {
    const old = mismatches({ ...base, target: { ...base.target, year: 1962, language: "ja" }, avoidsSubtitles: true });
    expect(old.map((f) => f.kind).sort()).toEqual(["era", "language"]);
    expect(old.find((f) => f.kind === "language")!.fact).toBe("It’s in Japanese, and you said you’d rather not read subtitles.");
    // A language they listed is fine.
    expect(mismatches({ ...base, target: { ...base.target, language: "ja" }, avoidsSubtitles: true, languages: ["en", "ja"] })).toEqual([]);
  });
});

describe("why-not output hygiene", () => {
  it("keeps reasons within 18 words", () => {
    const long = "This one moves very slowly through a long middle stretch that tests your patience before anything at all happens in it";
    expect(tidyReason(long).split(" ")).toHaveLength(18);
    expect(tidyReason(long).endsWith("…")).toBe(true);
    expect(tidyReason("  Short   and fine. ")).toBe("Short and fine.");
  });

  it("only lets reasons cite the evidence it was given, three at most", () => {
    const out = sanitizeWhyNot(
      {
        negatives: [
          { reason: "You dropped two slow dramas like this.", evidence: ["movie:1", "movie:999", "movie:1"] },
          { reason: "Too long for you.", evidence: [] },
          { reason: "x", evidence: [] },
          { reason: "It’s darker than you like.", evidence: [] },
          { reason: "A fourth reason never shows.", evidence: [] },
        ],
        positive: "  The score is beautiful.  ",
      },
      new Set(["movie:1"]),
    );
    expect(out.negatives).toHaveLength(3);
    expect(out.negatives[0]!.evidence).toEqual(["movie:1"]);
    expect(out.negatives.map((n) => n.reason)).not.toContain("x");
    expect(out.positive).toBe("The score is beautiful.");
  });

  it("builds an honest fallback from the evidence and facts", () => {
    const near: EvidenceTitle[] = [
      { key: "movie:1", title: "The Tree of Life", feeling: "dropped it partway through", liked: false, dropped: true, rating: null },
      { key: "movie:2", title: "Knight of Cups", feeling: "dropped it partway through", liked: false, dropped: true, rating: null },
      { key: "movie:3", title: "Arrival", feeling: "rated it 9/10 (loved it)", liked: true, dropped: false, rating: 9 },
    ];
    const out = fallbackWhyNot([{ kind: "pace", fact: "It’s a slow burn, and you lean toward faster-moving stories.", strength: 0.6 }], near);
    expect(out.negatives[0]).toEqual({ reason: "You dropped The Tree of Life or Knight of Cups, and this one is a lot like them.", evidence: ["movie:1", "movie:2"] });
    expect(out.negatives[1]!.evidence).toEqual([]);
    expect(out.positive).toBe("It shares a fair bit with Arrival, which you rated 9/10.");
    expect(fallbackWhyNot([], []).positive).toBeNull();
  });

  it("takes the median for the usual runtime", () => {
    expect(median([100, 140, 120])).toBe(120);
    expect(median([100, 120])).toBe(110);
    expect(median([])).toBeNull();
  });
});

describe("why-not feedback as a taste signal", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const key = "movie:42" as TitleKey;
  const empty = { library: [], watchlist: [], swipes: [], favourites: [] };

  it("is a whisper: weak, and only for titles with no stronger signal", () => {
    const [yes] = mergeSignals({ ...empty, whyNot: [{ key, helpful: true, at: now }] }, now);
    expect(yes).toMatchObject({ key, source: "feedback", type: "disliked", weight: WEIGHTS.whyNotConfirmed });
    const [no] = mergeSignals({ ...empty, whyNot: [{ key, helpful: false, at: now }] }, now);
    expect(no).toMatchObject({ source: "feedback", type: "liked", weight: WEIGHTS.whyNotRejected });
    expect(Math.abs(WEIGHTS.whyNotConfirmed)).toBeLessThan(Math.abs(WEIGHTS.dropped));
    // Saving it to the watchlist (or rating it) says more than the answer did.
    const [wl] = mergeSignals({ ...empty, watchlist: [{ key, at: now }], whyNot: [{ key, helpful: true, at: now }] }, now);
    expect(wl!.source).toBe("watchlist");
  });
});
