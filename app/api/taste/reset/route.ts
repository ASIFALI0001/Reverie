import { route } from "@/lib/http/route";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { resetTaste } from "@/lib/db/user-data";

/** Forget learned taste (keeps library + watchlist) and send the user back through onboarding. */
export const POST = route(
  { auth: "required", rateLimit: { name: "taste-reset", limit: 5, windowSec: 300 } },
  async ({ user }) => {
    await resetTaste(user.uid);
    await connectDb();
    await User.updateOne({ _id: user.uid }, { $set: { onboardingDone: false } });
    return { reset: true };
  },
);
