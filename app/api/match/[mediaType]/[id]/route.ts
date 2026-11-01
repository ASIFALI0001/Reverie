import { route } from "@/lib/http/route";
import { keyOf, TitleParams } from "@/lib/api/title-params";
import { getFullMatch } from "@/lib/reco/match-engine";
import { friendsOnTitle } from "@/lib/social/friends-on-title";
import { twinRatings } from "@/lib/twins/compute";
import { applyOutsideNudges, twinComponent } from "@/lib/twins/math";

/**
 * GET /api/match/:mediaType/:id — the viewer's full match (vector + features +
 * Gemini over their most similar titles), cached per taste-profile version, plus the friends
 * who watched it. Friends' ratings, and those of their Taste Twins when at least two rated it,
 * nudge the score (lib/twins/math.ts: together at most 20%); that part is never cached, so a
 * new rating shows up straight away.
 */
export const GET = route(
  { auth: "required", input: TitleParams, rateLimit: { name: "match", limit: 40, windowSec: 60, store: "mongo" } },
  async ({ user, input }) => {
    const key = keyOf(input);
    const match = await getFullMatch(user.uid, key);
    const base = match.status === "ok" ? match.score : null;
    const [found, twinRates] = await Promise.all([
      friendsOnTitle(user.uid, key, base).catch((err) => {
        console.warn("[match] friends unavailable:", err instanceof Error ? err.message : err);
        return null;
      }),
      base == null
        ? Promise.resolve([])
        : twinRatings(user.uid, key).catch((err) => {
            console.warn("[match] twins unavailable:", err instanceof Error ? err.message : err);
            return [];
          }),
    ]);
    // The raw ratings stay on the server.
    const { ratings: friendRates = [], ...friendsPart } = found ?? { ratings: [] };
    const friends = found ? friendsPart : null;
    if (match.status !== "ok" || base == null) return { ...match, friends, twins: null };

    const friendsOnly = applyOutsideNudges(base, friendRates, []);
    const both = applyOutsideNudges(base, friendRates, twinRates);
    const twins = {
      raters: twinComponent(twinRates)?.raters ?? 0,
      boost: both.twinWeight ? { from: friendsOnly.score, to: both.score, weight: both.twinWeight } : null,
    };
    return { ...match, score: both.score, friends, twins };
  },
);
