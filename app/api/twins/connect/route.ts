import { z } from "zod";
import { route } from "@/lib/http/route";
import { connectTwin } from "@/lib/twins/compute";

/** POST /api/twins/connect — connect with a twin (by its handle from /api/twins); both ways makes you friends. */
export const POST = route(
  {
    auth: "required",
    input: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }),
    rateLimit: { name: "twins-connect", limit: 30, windowSec: 3600, store: "mongo" },
  },
  async ({ user, input }) => connectTwin(user.uid, input.token),
);
