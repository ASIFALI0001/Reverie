import { route } from "@/lib/http/route";
import { notFound } from "@/lib/http/errors";
import { ensureIdentity } from "@/lib/social/identity";
import { inviteQrSvg, inviteUrl } from "@/lib/social/invite-link";

/** GET /api/invite/me — your invite code, its link, and the link as a QR code (SVG, in both inks). */
export const GET = route({ auth: "required", rateLimit: { name: "invite-me", limit: 60, windowSec: 60 } }, async ({ user }) => {
  const me = await ensureIdentity(user.uid);
  if (!me?.inviteCode) throw notFound("No profile yet. Sign in again to create it.");
  const url = inviteUrl(me.inviteCode);
  const [qrDark, qrLight] = await Promise.all([inviteQrSvg(url, "#ede6da"), inviteQrSvg(url, "#141210")]);
  return { code: me.inviteCode, url, qr: { dark: qrDark, light: qrLight } };
});
