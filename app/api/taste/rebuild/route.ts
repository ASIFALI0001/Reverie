import { route } from "@/lib/http/route";
import { buildTasteProfile, toTasteView } from "@/lib/reco/taste";

/** Rebuild now (summary included), rather than waiting for the next library change. */
export const POST = route(
  { auth: "required", rateLimit: { name: "taste-rebuild", limit: 3, windowSec: 300, store: "mongo" } },
  async ({ user }) => toTasteView(await buildTasteProfile(user.uid, { forceSummary: true, summaryBudgetMs: 20_000 })),
);
