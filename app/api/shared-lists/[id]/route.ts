import { z } from "zod";
import { route } from "@/lib/http/route";
import { LIST_NAME_MAX, deleteList, getList, renameList } from "@/lib/social/shared-lists";

const Id = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

/** GET /api/shared-lists/:id — the list, sorted by combined match, with every member's match per title. */
export const GET = route({ auth: "required", input: Id, rateLimit: { name: "lists-read", limit: 120, windowSec: 60 } }, async ({ user, input }) =>
  getList(user.uid, input.id),
);

/** PATCH /api/shared-lists/:id — rename it (owner). */
export const PATCH = route(
  { auth: "required", input: Id.extend({ name: z.string().trim().min(1).max(LIST_NAME_MAX) }), rateLimit: { name: "lists-edit", limit: 120, windowSec: 60 } },
  async ({ user, input }) => renameList(user.uid, input.id, input.name),
);

/** DELETE /api/shared-lists/:id — delete it for everyone (owner). */
export const DELETE = route({ auth: "required", input: Id, rateLimit: { name: "lists-edit", limit: 120, windowSec: 60 } }, async ({ user, input }) =>
  deleteList(user.uid, input.id),
);
