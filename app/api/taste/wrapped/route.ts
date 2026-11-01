import { z } from "zod";
import { route } from "@/lib/http/route";
import { badRequest } from "@/lib/http/errors";
import { getWrapped } from "@/lib/timeline/wrapped";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

/** GET /api/taste/wrapped?from=YYYY-MM-DD&to=YYYY-MM-DD — your viewing over any range, as a story (this year by default). */
export const GET = route(
  {
    auth: "required",
    input: z.object({ from: day.optional(), to: day.optional() }),
    rateLimit: { name: "taste-wrapped", limit: 30, windowSec: 300, store: "mongo" },
  },
  async ({ user, input }) => {
    const now = new Date();
    const from = new Date(`${input.from ?? `${now.getUTCFullYear()}-01-01`}T00:00:00Z`);
    const to = new Date(`${input.to ?? now.toISOString().slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(+from) || Number.isNaN(+to) || from > to) throw badRequest("The start date needs to come before the end.");
    if (to.getTime() - from.getTime() > 5 * 366 * 86_400_000) throw badRequest("Pick a range of five years or less.");
    return getWrapped(user.uid, from, to);
  },
);
