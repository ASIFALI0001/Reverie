import pLimit from "p-limit";
import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { WatchlistItem } from "@/lib/db/models/Library";
import { getWatchProviders } from "@/lib/sources/tmdb";
import { env } from "@/lib/env";
import type { MediaType } from "@/lib/catalog/types";

/** Which watchlist titles can be streamed right now in the user's region (providers cached 24h). */
export const GET = route({ auth: "required", rateLimit: { name: "availability", limit: 20, windowSec: 60 } }, async ({ user }) => {
  await connectDb();
  const [profile, items] = await Promise.all([
    User.findById(user.uid, { region: 1 }).lean(),
    WatchlistItem.find({ uid: user.uid }, { key: 1, mediaType: 1, tmdbId: 1 }).limit(300).lean(),
  ]);
  const region = profile?.region ?? env.defaultRegion();
  const limit = pLimit(6);
  const entries = await Promise.all(
    items.map((i) =>
      limit(async () => {
        try {
          const p = await getWatchProviders(i.mediaType as MediaType, i.tmdbId);
          const r = p.results?.[region];
          const stream = [...(r?.flatrate ?? []), ...(r?.free ?? []), ...(r?.ads ?? [])]
            .sort((a, b) => a.display_priority - b.display_priority)
            .map((x) => x.provider_name);
          return [i.key, [...new Set(stream)].slice(0, 3)] as const;
        } catch {
          return [i.key, [] as string[]] as const;
        }
      }),
    ),
  );
  return { region, streaming: Object.fromEntries(entries) as Record<string, string[]> };
});
