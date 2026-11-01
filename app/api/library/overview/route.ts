import { route } from "@/lib/http/route";
import { libraryOverview } from "@/lib/library/service";

/** Shelf index (categories → genre/franchise/anime/custom shelves with counts) plus stats. */
export const GET = route({ auth: "required" }, async ({ user }) => libraryOverview(user.uid));
