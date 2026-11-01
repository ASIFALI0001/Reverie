import { route } from "@/lib/http/route";
import { notFound } from "@/lib/http/errors";
import { ensureTitle } from "@/lib/catalog/ensure";
import { toCard } from "@/lib/catalog/cards";
import { TitleParams, keyOf } from "@/lib/api/title-params";

/** Lightweight title view (card fields + ratings + vibe) for client components. */
export const GET = route({ input: TitleParams, rateLimit: { name: "titles", limit: 120, windowSec: 60 } }, async ({ input }) => {
  const doc = await ensureTitle(keyOf(input), { enrich: false, jikan: false });
  if (!doc) throw notFound("We couldn’t find that title.");
  return { ...toCard(doc), overview: doc.overview, ratings: doc.ratings, vibe: doc.vibe, certification: doc.certification };
});
