import { route } from "@/lib/http/route";
import { notFound } from "@/lib/http/errors";
import { ensureTitle } from "@/lib/catalog/ensure";
import { getVibeVideos } from "@/lib/sources/youtube";
import { TitleParams, keyOf } from "@/lib/api/title-params";

/** Official trailers (TMDB) plus fan edits, reviews and explainers (YouTube, quota-aware). */
export const GET = route(
  // Shared limit: every uncached title here can cost ~101 YouTube quota units.
  { input: TitleParams, rateLimit: { name: "videos", limit: 20, windowSec: 60, store: "mongo" } },
  async ({ input }) => {
    const key = keyOf(input);
    const doc = await ensureTitle(key, { enrich: false, jikan: false });
    if (!doc) throw notFound("We couldn’t find that title.");
    const yt = await getVibeVideos({ key, title: doc.title, year: doc.year });
    return {
      trailers: doc.videos,
      edit: yt?.edit ?? [],
      review: yt?.review ?? [],
      explained: yt?.explained ?? [],
      youtube: yt !== null && !yt.quotaLimited,
    };
  },
);
