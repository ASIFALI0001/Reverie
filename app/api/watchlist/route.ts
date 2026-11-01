import { z } from "zod";
import { route } from "@/lib/http/route";
import { addToWatchlist, getWatchlist } from "@/lib/library/service";

export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await getWatchlist(user.uid) }));

export const POST = route(
  {
    auth: "required",
    input: z.object({ mediaType: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive(), hiddenFromFriends: z.boolean().optional() }),
    rateLimit: { name: "watchlist-write", limit: 60, windowSec: 60 },
  },
  async ({ user, input }) => {
    await addToWatchlist(user.uid, input.mediaType, input.tmdbId, { hiddenFromFriends: input.hiddenFromFriends });
    return { added: true };
  },
);
