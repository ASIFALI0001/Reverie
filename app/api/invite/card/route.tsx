import { ImageResponse } from "next/og";
import { route } from "@/lib/http/route";
import { notFound } from "@/lib/http/errors";
import { initials } from "@/components/ui/Avatar";
import { TINT_HEX, isAvatarTint } from "@/lib/avatar";
import { ensureIdentity } from "@/lib/social/identity";
import { inviteQrSvg, inviteUrl } from "@/lib/social/invite-link";
import { publicDna } from "@/lib/social/profile";
import { toPerson } from "@/lib/social/people";
import { ogFonts } from "@/lib/og/fonts";

const W = 1080;
const H = 1350;
const INK = "#ede6da";
const MUTED = "#8a8378";
const ACCENT = "#e8a23a";
const HAIRLINE = "rgba(237,230,218,0.17)";

/**
 * GET /api/invite/card — your invite as a portrait card (1080×1350 PNG): who you are, your Taste
 * DNA, and a QR code for your invite link. Personal, so it's made on request and never cached.
 */
export const GET = route({ auth: "required", rateLimit: { name: "invite-card", limit: 20, windowSec: 60 } }, async ({ user }) => {
  const me = await ensureIdentity(user.uid);
  if (!me?.inviteCode) throw notFound("No profile yet. Sign in again to create it.");
  const person = toPerson(me);
  const url = inviteUrl(me.inviteCode);
  // Dark on a paper plate, like the in-app panel: every scanner reads that, inverted codes not always.
  const [qr, dna, fonts] = await Promise.all([inviteQrSvg(url, "#141210"), publicDna(user.uid), ogFonts()]);
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`;
  const tint = TINT_HEX[isAvatarTint(person.avatar.tint) ? person.avatar.tint : "tungsten"];
  const phrases = dna.slice(0, 3);
  const link = url.replace(/^https?:\/\//, "");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          padding: "84px 88px",
          background: "#0c0b0a",
          backgroundImage: "radial-gradient(circle at 18% 0%, rgba(232,162,58,0.16), rgba(12,11,10,0) 55%)",
          color: INK,
          fontFamily: "Instrument Sans",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 44, color: ACCENT }}>Reverie</div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>AN INVITATION</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 92 }}>
          {person.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoURL} alt="" width={148} height={148} style={{ width: 148, height: 148, borderRadius: 74, objectFit: "cover" }} />
          ) : (
            <div
              style={{
                display: "flex",
                width: 148,
                height: 148,
                borderRadius: 74,
                background: tint,
                color: "#141210",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Instrument Serif",
                fontSize: 64,
              }}
            >
              {initials(person.name)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: person.name.length > 16 ? 68 : 88, lineHeight: 1 }}>{person.name}</div>
            {person.handle ? <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 14 }}>@{person.handle}</div> : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 72, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>TASTE DNA</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, borderTop: `1px solid ${HAIRLINE}` }}>
            {(phrases.length ? phrases : ["Still learning what they love"]).map((p) => (
              <div key={p} style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 50, lineHeight: 1.1, padding: "20px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
                {p}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
          <div style={{ display: "flex", padding: 24, background: INK, borderRadius: 8, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="" width={232} height={232} style={{ width: 232, height: 232 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: 10 }}>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 50, lineHeight: 1.05 }}>Scan to see how our tastes match.</div>
            <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 18 }}>{link}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
      headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="reverie-invite-${person.handle ?? "card"}.png"` },
    },
  );
});
