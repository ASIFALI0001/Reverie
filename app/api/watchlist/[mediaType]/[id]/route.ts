import { z } from "zod";
import { route } from "@/lib/http/route";
import { removeFromWatchlist, updateWatchlistItem } from "@/lib/library/service";
import { TitleParams } from "@/lib/api/title-params";

/** PATCH /api/watchlist/:mediaType/:id — hide it from friends, or show it again. */
export const PATCH = route(
  {
    auth: "required",
    input: TitleParams.extend({ hiddenFromFriends: z.boolean() }),
    rateLimit: { name: "watchlist-write", limit: 60, windowSec: 60 },
  },
  async ({ user, input }) => updateWatchlistItem(user.uid, input.mediaType, input.id, { hiddenFromFriends: input.hiddenFromFriends }),
);

export const DELETE = route({ auth: "required", input: TitleParams }, async ({ user, input }) => {
  await removeFromWatchlist(user.uid, input.mediaType, input.id);
  return { removed: true };
});
