import { z } from "zod";
import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { getRegionServices } from "@/lib/sources/tmdb";
import { env } from "@/lib/env";

/** GET /api/services[?region=XX] — streaming services in your region (or another), for "My services". */
export const GET = route(
  { auth: "required", input: z.object({ region: z.string().regex(/^[A-Z]{2}$/).optional() }), rateLimit: { name: "services-read", limit: 60, windowSec: 60 } },
  async ({ user, input }) => {
    await connectDb();
    const region = input.region ?? (await User.findById(user.uid, { region: 1 }).lean())?.region ?? env.defaultRegion();
    return { region, services: await getRegionServices(region) };
  },
);
