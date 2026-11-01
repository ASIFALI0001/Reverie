import { route } from "@/lib/http/route";
import { RECENT_SIGN_IN_S } from "@/lib/admin/moderation";

/** GET /api/admin/me — the signed-in administrator (and whether a sensitive action needs a fresh sign-in). */
export const GET = route({ auth: "admin", rateLimit: { name: "admin-read", limit: 240, windowSec: 60 } }, ({ user }) => ({
  uid: user.uid,
  email: user.email,
  name: user.name,
  recentSignIn: Date.now() / 1000 - user.authTime <= RECENT_SIGN_IN_S,
}));
