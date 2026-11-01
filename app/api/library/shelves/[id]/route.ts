import { z } from "zod";
import { route } from "@/lib/http/route";
import { deleteShelf, renameShelf } from "@/lib/library/service";

const Id = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

export const PATCH = route({ auth: "required", input: Id.extend({ name: z.string().trim().min(1).max(40) }) }, async ({ user, input }) => {
  await renameShelf(user.uid, input.id, input.name);
  return { renamed: true };
});

export const DELETE = route({ auth: "required", input: Id }, async ({ user, input }) => {
  await deleteShelf(user.uid, input.id);
  return { deleted: true };
});
