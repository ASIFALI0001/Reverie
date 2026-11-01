import { z } from "zod";
import { route } from "@/lib/http/route";
import { createShelf, libraryOverview } from "@/lib/library/service";

export const GET = route({ auth: "required" }, async ({ user }) => ({ shelves: (await libraryOverview(user.uid)).custom }));

export const POST = route(
  { auth: "required", input: z.object({ name: z.string().trim().min(1, "Give the shelf a name.").max(40) }) },
  async ({ user, input }) => createShelf(user.uid, input.name),
);
