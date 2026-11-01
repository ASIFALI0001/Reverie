import { z } from "zod";
import { route } from "@/lib/http/route";
import { titleKey } from "@/lib/catalog/types";
import { removeListItem } from "@/lib/social/shared-lists";

/** DELETE /api/shared-lists/:id/items/:mediaType/:tmdbId — take a title off (any member). */
export const DELETE = route(
  {
    auth: "required",
    input: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), mediaType: z.enum(["movie", "tv"]), tmdbId: z.coerce.number().int().positive() }),
    rateLimit: { name: "lists-edit", limit: 120, windowSec: 60 },
  },
  async ({ user, input }) => removeListItem(user.uid, input.id, titleKey(input.mediaType, input.tmdbId)),
);
