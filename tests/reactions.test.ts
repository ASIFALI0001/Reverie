import { describe, expect, it } from "vitest";
import { describeReactions, DIDNT_IDS, hasReactions, reactionLabels, reviewSnippet, WORKED_IDS } from "@/lib/library/reactions";
import { LibraryFields } from "@/lib/api/library-schemas";
import { neighbourLine } from "@/lib/ai/match-judge";

describe("reactions", () => {
  it("labels known ids in order and drops unknown ones", () => {
    expect(reactionLabels(["dialogue", "humour", "nope"])).toEqual(["dialogue", "humour"]);
    expect(reactionLabels(["slow", "weak-ending"])).toEqual(["too slow", "weak ending"]);
    expect(reactionLabels(null)).toEqual([]);
  });

  it("describes a take in one line, or null when there's nothing", () => {
    expect(describeReactions({ worked: ["dialogue", "humour"], didnt: ["slow"], note: "  The banter\ncarries it.  " })).toBe(
      "worked: dialogue, humour · didn't: too slow · in their words: “The banter carries it.”",
    );
    expect(describeReactions({ worked: [], didnt: [], note: "   " })).toBeNull();
    expect(describeReactions({ didnt: ["predictable"] })).toBe("didn't: predictable");
    expect(hasReactions({ note: "loved it" })).toBe(true);
    expect(hasReactions({ worked: [], didnt: [], note: "" })).toBe(false);
  });

  it("cuts a long review at a word boundary", () => {
    const long = "word ".repeat(100);
    const snippet = reviewSnippet(long, 40)!;
    expect(snippet.length).toBeLessThanOrEqual(41);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).not.toMatch(/wor…$/);
  });

  it("only accepts known chips, at most six a side", () => {
    expect(LibraryFields.safeParse({ worked: ["story", "music"], didnt: ["long"] }).success).toBe(true);
    expect(LibraryFields.safeParse({ worked: ["made-up"] }).success).toBe(false);
    expect(LibraryFields.safeParse({ didnt: DIDNT_IDS.slice(0, 7) }).success).toBe(false);
    expect(WORKED_IDS.length).toBeGreaterThan(8);
  });

  it("puts the viewer's take under the title in the match prompt", () => {
    const line = neighbourLine({
      id: "movie:68721",
      title: "Iron Man 3",
      year: 2013,
      genres: ["Action", "Adventure", "Science Fiction"],
      feeling: "rated it 9/10 (loved it)",
      liked: true,
      vibe: "Quippy, fast and loud.",
      reactions: describeReactions({ worked: ["dialogue", "humour"], didnt: ["weak-villain"] }),
    });
    expect(line).toBe(
      "- [movie:68721] Iron Man 3 (2013) · Action, Adventure, Science Fiction · rated it 9/10 (loved it)\n  Their take: worked: dialogue, humour · didn't: weak villain\n  Quippy, fast and loud.",
    );
  });
});
