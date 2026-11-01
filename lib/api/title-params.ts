import { z } from "zod";
import { titleKey, type TitleKey } from "@/lib/catalog/types";

/** Shared input schema for /api/…/[mediaType]/[id] routes. */
export const TitleParams = z.object({
  mediaType: z.enum(["movie", "tv"]),
  id: z.coerce.number().int().positive(),
});

export function keyOf(p: z.infer<typeof TitleParams>): TitleKey {
  return titleKey(p.mediaType, p.id);
}

/** A title key in a request body: "movie:68721" / "tv:1399". */
export const TitleKeySchema = z
  .string()
  .regex(/^(movie|tv):[1-9][0-9]{0,8}$/)
  .transform((s) => s as TitleKey);
