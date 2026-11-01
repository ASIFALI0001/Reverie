import { z } from "zod";
import { route } from "@/lib/http/route";
import { addListItem } from "@/lib/social/shared-lists";

/** POST /api/shared-lists/:id/items — add a title (any member). */
export const POST = route(
  {
    auth: "required",
    input: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), mediaType: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive() }),
    rateLimit: { name: "lists-edit", limit: 120, windowSec: 60 },
  },
  async ({ user, input }) => addListItem(user.uid, input.id, input.mediaType, input.tmdbId),
);
