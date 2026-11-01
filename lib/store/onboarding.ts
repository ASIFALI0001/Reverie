import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Category, TitleKey } from "@/lib/catalog/types";
import type { Ending, SwipeVerdict, TasteAnswers, TasteView } from "@/lib/taste/types";

export const STEPS = ["intro", "formats", "moods", "swipe", "favourites", "quick", "building"] as const;
export type Step = (typeof STEPS)[number];

export type SwipeRecord = { key: TitleKey; verdict: SwipeVerdict; title: string; posterPath: string };
export type Favourite = { key: TitleKey; title: string; year: number | null; posterPath: string | null };

type Answers = {
  formats: Category[];
  genres: string[];
  pace: number | null;
  tone: number | null;
  complexity: number | null;
  era: number | null;
  endings: Ending | null;
  subtitles: boolean | null;
  /** null until seeded from the viewer's profile (region + saved languages). */
  languages: string[] | null;
};

type State = Answers & {
  step: Step;
  /** 1 = forward, -1 = back: steps slide the way you're going. */
  dir: 1 | -1;
  swipes: SwipeRecord[];
  favourites: Favourite[];
  result: TasteView | null;
  go: (step: Step) => void;
  next: () => void;
  back: () => void;
  set: (patch: Partial<Answers>) => void;
  toggle: (field: "formats" | "genres" | "languages", value: string) => void;
  swipe: (record: SwipeRecord) => void;
  undoSwipe: () => void;
  addFavourite: (f: Favourite) => void;
  removeFavourite: (key: TitleKey) => void;
  finish: (result: TasteView | null) => void;
  reset: () => void;
};

const initial: Answers & Pick<State, "step" | "dir" | "swipes" | "favourites" | "result"> = {
  step: "intro",
  dir: 1,
  formats: [],
  genres: [],
  pace: null,
  tone: null,
  complexity: null,
  era: null,
  endings: null,
  subtitles: null,
  languages: null,
  swipes: [],
  favourites: [],
  result: null,
};

const at = (step: Step) => STEPS.indexOf(step);

/**
 * Onboarding progress. Kept in sessionStorage so a refresh mid-swipe picks up
 * where you were, and forgotten when the tab closes.
 */
export const useOnboarding = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      go: (step) => set({ step, dir: at(step) >= at(get().step) ? 1 : -1 }),
      next: () => set({ step: STEPS[Math.min(at(get().step) + 1, STEPS.length - 1)]!, dir: 1 }),
      back: () => set({ step: STEPS[Math.max(at(get().step) - 1, 0)]!, dir: -1 }),
      set: (patch) => set(patch),
      toggle: (field, value) =>
        set((s) => {
          const cur = (s[field] ?? []) as string[];
          return { [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] } as Partial<State>;
        }),
      swipe: (record) => set((s) => ({ swipes: [...s.swipes.filter((x) => x.key !== record.key), record] })),
      undoSwipe: () => set((s) => ({ swipes: s.swipes.slice(0, -1) })),
      addFavourite: (f) =>
        set((s) => (s.favourites.length >= 3 || s.favourites.some((x) => x.key === f.key) ? s : { favourites: [...s.favourites, f] })),
      removeFavourite: (key) => set((s) => ({ favourites: s.favourites.filter((f) => f.key !== key) })),
      finish: (result) => set({ result }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "reverie-onboarding",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ step, ...s }) => ({
        // Never resume into the building moment: the request it waits on is gone.
        step: step === "building" ? "quick" : step,
        formats: s.formats,
        genres: s.genres,
        pace: s.pace,
        tone: s.tone,
        complexity: s.complexity,
        era: s.era,
        endings: s.endings,
        subtitles: s.subtitles,
        languages: s.languages,
        swipes: s.swipes,
        favourites: s.favourites,
      }),
    },
  ),
);

/** The request body for POST /api/onboarding. */
export function toSubmission(s: State): TasteAnswers & { swipes: { key: TitleKey; verdict: SwipeVerdict }[]; favourites: TitleKey[] } {
  return {
    formats: s.formats,
    genres: s.genres,
    pace: s.pace,
    tone: s.tone,
    complexity: s.complexity,
    era: s.era,
    endings: s.endings,
    subtitles: s.subtitles,
    languages: s.languages ?? [],
    swipes: s.swipes.map(({ key, verdict }) => ({ key, verdict })),
    favourites: s.favourites.map((f) => f.key),
  };
}
