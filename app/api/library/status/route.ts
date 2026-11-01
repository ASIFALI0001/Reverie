import { z } from "zod";
import { route } from "@/lib/http/route";
import { badRequest } from "@/lib/http/errors";
import { libraryStatus } from "@/lib/library/service";
import { parseTitleKey, type TitleKey } from "@/lib/catalog/types";

/** Library + watchlist state for specific titles: ?keys=movie:68721,tv:1396 */
export const GET = route({ auth: "required", input: z.object({ keys: z.string().max(5000) }) }, async ({ user, input }) => {
  const keys = input.keys.split(",").filter((k): k is TitleKey => parseTitleKey(k) !== null);
  if (keys.length === 0 || keys.length > 200) throw badRequest("Pass between 1 and 200 title keys.");
  return libraryStatus(user.uid, keys);
});
