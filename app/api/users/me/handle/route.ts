import { z } from "zod";
import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { notFound } from "@/lib/http/errors";
import { checkHandle, setHandle } from "@/lib/social/identity";

/** GET /api/users/me/handle — your handle; with ?check=name, whether that one is free. */
export const GET = route(
  { auth: "required", input: z.object({ check: z.string().max(40).optional() }), rateLimit: { name: "handle-check", limit: 90, windowSec: 60 } },
  async ({ user, input }) => {
    if (input.check != null) return checkHandle(user.uid, input.check);
    await connectDb();
    const me = await User.findById(user.uid, { handle: 1, handleChosen: 1 }).lean();
    if (!me) throw notFound("No profile yet.");
    return { handle: me.handle ?? null, chosen: Boolean(me.handleChosen) };
  },
);

/** PATCH /api/users/me/handle — pick or confirm your @handle. */
export const PATCH = route(
  { auth: "required", input: z.object({ handle: z.string().min(1).max(40) }), rateLimit: { name: "handle-write", limit: 10, windowSec: 60, store: "mongo" } },
  async ({ user, input }) => setHandle(user.uid, input.handle),
);
