import { CATEGORY_LABEL } from "@/lib/catalog/category";
import type { TitleCore, Vibe } from "@/lib/catalog/types";

const LANGUAGE = new Intl.DisplayNames(["en"], { type: "language" });
const langName = (code: string) => {
  try {
    return LANGUAGE.of(code) ?? code;
  } catch {
    return code;
  }
};

const band = (v: number, low: string, mid: string, high: string) => (v < 0.34 ? low : v > 0.66 ? high : mid);

/**
 * The dense paragraph we embed for each title: identity, people, story and —
 * when available — the AI "feel". Ordered so the most distinctive signal comes first.
 */
export function profileText(t: TitleCore, vibe?: Vibe | null): string {
  const kind = CATEGORY_LABEL[t.category].replace(/s$/, "").toLowerCase();
  const people = [
    t.directors.length ? `Directed by ${t.directors.map((p) => p.name).join(", ")}.` : "",
    t.creators.length ? `Created by ${t.creators.map((p) => p.name).join(", ")}.` : "",
    t.topCast.length ? `Starring ${t.topCast.slice(0, 6).map((p) => p.name).join(", ")}.` : "",
  ];
  const parts = [
    `${t.title}${t.year ? ` (${t.year})` : ""}: ${/^[aeiou]/i.test(langName(t.originalLanguage)) ? "an" : "a"} ${langName(t.originalLanguage)}-language ${kind}${t.originCountry.length ? ` from ${t.originCountry.join("/")}` : ""}.`,
    t.genres.length ? `Genres: ${t.genres.join(", ")}.` : "",
    ...people,
    t.collection ? `Part of the ${t.collection.name}.` : "",
    t.tagline ? `Tagline: “${t.tagline}”.` : "",
    t.overview ? `Story: ${t.overview}` : "",
    vibe
      ? `Feel: ${vibe.summary} Pace: ${band(vibe.pace, "slow-burn", "measured", "fast and loud")}; tone: ${band(vibe.tone, "light", "bittersweet", "dark")}; complexity: ${band(vibe.complexity, "easy watch", "engaging", "cerebral")}. Themes: ${vibe.themes.join(", ")}. Mood: ${vibe.mood.join(", ")}.`
      : "",
    t.keywords.length ? `Keywords: ${t.keywords.slice(0, 20).join(", ")}.` : "",
  ];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
