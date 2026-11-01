import { z } from "zod";
import { route } from "@/lib/http/route";
import { LIST_NAME_MAX, createList, listsFor } from "@/lib/social/shared-lists";

/** GET /api/shared-lists — the shared watchlists you're on. */
export const GET = route({ auth: "required", rateLimit: { name: "lists-read", limit: 120, windowSec: 60 } }, async ({ user }) => ({
  lists: await listsFor(user.uid),
}));

/** POST /api/shared-lists — start one with some friends. */
export const POST = route(
  {
    auth: "required",
    input: z.object({ name: z.string().trim().min(1, "Give it a name.").max(LIST_NAME_MAX), members: z.array(z.string().min(1).max(128)).min(1).max(7) }),
    rateLimit: { name: "lists-write", limit: 30, windowSec: 3600, store: "mongo" },
  },
  async ({ user, input }) => createList(user.uid, input.name, input.members),
);
