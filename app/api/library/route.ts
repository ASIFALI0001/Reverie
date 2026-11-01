import { z } from "zod";
import { route } from "@/lib/http/route";
import { addToLibrary, getLibraryEntries } from "@/lib/library/service";
import { Category, LibraryFields } from "@/lib/api/library-schemas";
import { LIBRARY_STATUSES } from "@/lib/db/models/Library";
import type { TitleKey } from "@/lib/catalog/types";

const ListInput = z.object({
  category: Category.optional(),
  shelf: z.string().max(80).optional(),
  customShelf: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  status: z.enum(LIBRARY_STATUSES).optional(),
  key: z.string().regex(/^(movie|tv):\d+$/).optional(),
});

export const GET = route({ auth: "required", input: ListInput }, async ({ user, input }) => {
  const { key, ...rest } = input;
  return { items: await getLibraryEntries(user.uid, { ...rest, keys: key ? [key as TitleKey] : undefined }) };
});

const AddInput = LibraryFields.extend({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
});

/** Add (or update) a title in the library. Moves it off the watchlist. */
export const POST = route(
  { auth: "required", input: AddInput, rateLimit: { name: "library-write", limit: 60, windowSec: 60 } },
  async ({ user, input }) => {
    const { mediaType, tmdbId, ...fields } = input;
    return addToLibrary(user.uid, mediaType, tmdbId, fields);
  },
);
