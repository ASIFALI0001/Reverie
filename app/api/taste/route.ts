import { route } from "@/lib/http/route";
import { getFreshProfile, toTasteView } from "@/lib/reco/taste";

/** The viewer's taste profile as the UI shows it (Taste DNA, radar, vibe). */
export const GET = route({ auth: "required" }, async ({ user }) => toTasteView(await getFreshProfile(user.uid)));
