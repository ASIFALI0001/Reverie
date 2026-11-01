import { describe, expect, it } from "vitest";
import { answerStatement, describeAnswers, leaning, SCALES } from "@/lib/taste/statement";
import type { TasteAnswers } from "@/lib/taste/types";

const base: TasteAnswers = {
  formats: [],
  genres: [],
  pace: null,
  tone: null,
  complexity: null,
  era: null,
  endings: null,
  subtitles: null,
  languages: [],
};

describe("answers in words", () => {
  it("maps a 0–1 scale onto five leanings", () => {
    expect(leaning(0.1, SCALES.pace)).toBe("strongly prefers slow-burn");
    expect(leaning(0.35, SCALES.pace)).toBe("leans slow-burn");
    expect(leaning(0.5, SCALES.pace)).toBe("no strong preference between slow-burn and fast and loud");
    expect(leaning(0.7, SCALES.tone)).toBe("leans dark");
    expect(leaning(0.95, SCALES.era)).toBe("strongly prefers classics");
  });

  it("describes only what was answered", () => {
    const text = describeAnswers({ ...base, formats: ["movie", "anime"], genres: ["sci-fi", "dark"], tone: 0.9, languages: ["en", "hi"] });
    expect(text).toContain("- Watches: Movies and Anime");
    expect(text).toContain("- Picked genres: Sci-Fi");
    expect(text).toContain("- Picked moods: Dark");
    expect(text).toContain("- Tone: strongly prefers dark");
    expect(text).toContain("- Languages: English and Hindi");
    expect(text).not.toContain("Pace");
    expect(describeAnswers(base)).toBe("");
  });

  it("turns answers into one search-style sentence for the answer vector", () => {
    const s = answerStatement({
      ...base,
      formats: ["movie", "series"],
      genres: ["thriller", "mind-bending"],
      pace: 0.2,
      tone: 0.8,
      era: 0.9,
      endings: "ambiguous",
      languages: ["ko"],
    });
    expect(s).toBe("Mind-bending, slow-burn and dark Thriller movies and series. Classics welcome. Likes ambiguous endings. In Korean.");
  });

  it("still says something sensible with no answers", () => {
    expect(answerStatement(base)).toBe("Films and series.");
  });
});
