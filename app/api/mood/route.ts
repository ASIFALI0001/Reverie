import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { COMPANY_OPTIONS, MOOD_PRESETS, TIME_OPTIONS } from "@/lib/mood/target";

/** GET /api/mood — the mood tiles, time and company choices, and whether "my services" can filter. */
export const GET = route({ auth: "required", rateLimit: { name: "mood-read", limit: 120, windowSec: 60 } }, async ({ user }) => {
  await connectDb();
  const me = await User.findById(user.uid, { services: 1 }).lean();
  return {
    presets: MOOD_PRESETS.map((p) => ({ id: p.id, label: p.label, line: p.line })),
    times: TIME_OPTIONS,
    companies: COMPANY_OPTIONS,
    servicesCount: (me?.services ?? []).length,
  };
});
