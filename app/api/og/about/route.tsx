import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og/fonts";
import { matchColorHex } from "@/lib/match-color";

const W = 1200;
const H = 630;

/** GET /api/og/about — the About page's share card: the name, the promise, and a dial. Cached for a day. */
export async function GET() {
  const fonts = await ogFonts();
  const c = 2 * Math.PI * 92;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: W, height: H, padding: "72px 84px", background: "#0c0b0a", backgroundImage: "radial-gradient(circle at 82% 30%, rgba(232,162,58,0.18), rgba(12,11,10,0) 55%)", color: "#ede6da", fontFamily: "Instrument Sans", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: "#8a8378" }}>THE STORY OF</div>
          <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 150, lineHeight: 0.9, marginTop: 18 }}>Reverie</div>
          <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 44, lineHeight: 1.1, marginTop: 28, color: "rgba(237,230,218,0.9)" }}>Know you’ll love it before you press play.</div>
          <div style={{ display: "flex", fontSize: 24, color: "#8a8378", marginTop: 26 }}>Sixteen chapters, one scroll.</div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 230, height: 230, alignItems: "center", justifyContent: "center" }}>
          <svg width="230" height="230" viewBox="0 0 230 230" style={{ position: "absolute", top: 0, left: 0 }}>
            <circle cx="115" cy="115" r="92" fill="none" stroke="rgba(237,230,218,0.16)" strokeWidth="3" />
            <circle cx="115" cy="115" r="92" fill="none" stroke={matchColorHex(92)} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * 0.92} ${c}`} transform="rotate(-90 115 115)" />
          </svg>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 400 }}>92%</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
