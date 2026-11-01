import { route } from "@/lib/http/route";
import { keyOf, TitleParams } from "@/lib/api/title-params";
import { getSimilar } from "@/lib/reco/similar";
import { getQuickScores } from "@/lib/reco/match-engine";

/**
 * GET /api/similar/:mediaType/:id — twelve titles that feel like this one, each
 * with a "why". Signed in, each also carries the viewer's match estimate.
 */
export const GET = route(
  { auth: "optional", input: TitleParams, rateLimit: { name: "similar", limit: 30, windowSec: 60, store: "mongo" } },
  async ({ user, input }) => {
    const items = await getSimilar(keyOf(input));
    const scores = user && items.length ? await getQuickScores(user.uid, items.map((i) => i.key)) : {};
    return { items: items.map((i) => ({ ...i, match: scores[i.key] ?? null })) };
  },
);
