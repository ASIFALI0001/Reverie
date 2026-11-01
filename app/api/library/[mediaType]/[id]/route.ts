import { route } from "@/lib/http/route";
import { removeFromLibrary, updateLibraryItem } from "@/lib/library/service";
import { LibraryFields } from "@/lib/api/library-schemas";
import { TitleParams } from "@/lib/api/title-params";

export const PATCH = route(
  { auth: "required", input: TitleParams.extend(LibraryFields.shape), rateLimit: { name: "library-write", limit: 60, windowSec: 60 } },
  async ({ user, input }) => {
    const { mediaType, id, ...fields } = input;
    return updateLibraryItem(user.uid, mediaType, id, fields);
  },
);

export const DELETE = route({ auth: "required", input: TitleParams }, async ({ user, input }) => {
  await removeFromLibrary(user.uid, input.mediaType, input.id);
  return { removed: true };
});
