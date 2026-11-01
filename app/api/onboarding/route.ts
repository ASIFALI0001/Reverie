import { z } from "zod";
import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { tasteCol } from "@/lib/db/taste";
import { TitleKeySchema } from "@/lib/api/title-params";
import { ensureTitles } from "@/lib/catalog/ensure";
import { buildTasteProfile, ensureProfileDoc, keepAlive, scheduleTasteRebuild, toTasteView } from "@/lib/reco/taste";
import { knownChips } from "@/lib/taste/chips";
import type { TasteAnswers } from "@/lib/taste/types";

const Scale = z.number().min(0).max(1).nullable().default(null);

const Answers = z.object({
  formats: z.array(z.enum(["movie", "series", "anime", "cartoon"])).max(4).default([]),
  genres: z.array(z.string().max(32)).max(40).default([]),
  pace: Scale,
  tone: Scale,
  complexity: Scale,
  era: Scale,
  endings: z.enum(["happy", "ambiguous", "tragic", "any"]).nullable().default(null),
  subtitles: z.boolean().nullable().default(null),
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(14).default([]),
  swipes: z
    .array(z.object({ key: TitleKeySchema, verdict: z.enum(["loved", "disliked", "unseen"]) }))
    .max(60)
    .default([]),
  favourites: z.array(TitleKeySchema).max(3).default([]),
});

const Input = z.union([z.object({ skip: z.literal(true) }), Answers]);

/** New favourites get fetched and enriched; past this budget we move on and they finish in the background. */
const FAVOURITES_BUDGET_MS = 8000;
/** Gemini gets this long to write the Taste DNA before the reveal uses the deterministic version. */
const SUMMARY_BUDGET_MS = 14_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Finish onboarding. Skipping just marks it done; answering saves the answers
 * and swipes, builds the taste profile (the "Building your taste…" moment
 * waits on this) and returns the Taste DNA.
 */
export const POST = route(
  { auth: "required", input: Input, rateLimit: { name: "onboarding", limit: 8, windowSec: 300, store: "mongo" } },
  async ({ user, input }) => {
    await connectDb();
    if ("skip" in input) {
      await User.updateOne({ _id: user.uid }, { $set: { onboardingDone: true } });
      return { onboardingDone: true, taste: null };
    }

    const now = new Date();
    const { swipes, favourites, ...rest } = input;
    const answers: TasteAnswers = { ...rest, genres: knownChips(rest.genres).map((c) => c.id), languages: [...new Set(rest.languages)] };

    if (favourites.length) {
      const ensuring = ensureTitles(favourites);
      const done = await Promise.race([ensuring.then(() => true), sleep(FAVOURITES_BUDGET_MS).then(() => false)]);
      if (!done) keepAlive(ensuring);
    }

    await ensureProfileDoc(user.uid);
    const col = await tasteCol();
    await col.updateOne(
      { uid: user.uid },
      {
        $set: {
          answers,
          onboarding: {
            swipes: dedupe(swipes).map((s) => ({ ...s, at: now })),
            favourites: [...new Set(favourites)].map((key) => ({ key, at: now })),
            completedAt: now,
          },
          dirty: true,
          dirtyAt: now,
        },
      },
    );
    await User.updateOne(
      { _id: user.uid },
      { $set: { onboardingDone: true, ...(answers.languages.length ? { languages: answers.languages } : {}) } },
    );

    try {
      const profile = await buildTasteProfile(user.uid, { forceSummary: true, summaryBudgetMs: SUMMARY_BUDGET_MS });
      return { onboardingDone: true, taste: toTasteView(profile) };
    } catch (err) {
      console.error("[onboarding] profile build failed; retrying in the background", err);
      scheduleTasteRebuild(user.uid);
      return { onboardingDone: true, taste: null };
    }
  },
);

/** The last verdict per title wins (undo + re-swipe sends both). */
function dedupe<T extends { key: string }>(xs: T[]): T[] {
  return [...new Map(xs.map((x) => [x.key, x])).values()];
}
