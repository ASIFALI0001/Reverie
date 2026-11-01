import { ImageResponse } from "next/og";
import { route } from "@/lib/http/route";
import { notFound } from "@/lib/http/errors";
import { ensureIdentity } from "@/lib/social/identity";
import { inviteQrSvg, inviteUrl } from "@/lib/social/invite-link";
import { toPerson } from "@/lib/social/people";
import { getFreshProfile, toTasteView } from "@/lib/reco/taste";
import { getTimeline, shareTopTitles } from "@/lib/timeline/timeline";
import { tmdbImgUrl } from "@/lib/images/tmdb";
import { ogFonts } from "@/lib/og/fonts";
import type { RadarPoint } from "@/lib/taste/types";

const INK = "#ede6da";
const MUTED = "#8a8378";
const ACCENT = "#e8a23a";
const HAIRLINE = "rgba(237,230,218,0.17)";
const FORMATS = { story: { w: 1080, h: 1920 }, wide: { w: 1200, h: 630 } } as const;

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** A poster inlined for the image (a slow or missing one is left out rather than failing the card). */
async function posterData(path: string): Promise<string | null> {
  try {
    const res = await fetch(tmdbImgUrl(path, "w342")!, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The genre radar: rings and the shape as an SVG image, the axis names as text around it (an SVG
 * image is rasterised without fonts, so its own text wouldn't show). The strongest axis in full ink.
 */
function Radar({ points, size }: { points: RadarPoint[]; size: number }) {
  const c = size / 2;
  const r = size * 0.34;
  const at = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i / points.length) * Math.PI * 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const ring = (v: (i: number) => number) => points.map((_, i) => at(i, v(i)).map((n) => n.toFixed(1)).join(",")).join(" ");
  const vals = points.map((p) => Math.max(0.04, Math.min(1, p.value)));
  const strongest = vals.indexOf(Math.max(...vals));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${[0.25, 0.5, 0.75, 1]
    .map((v) => `<polygon points="${ring(() => v)}" fill="none" stroke="${v === 0.5 ? "rgba(237,230,218,0.22)" : "rgba(237,230,218,0.1)"}" stroke-width="1.5"/>`)
    .join("")}<polygon points="${ring((i) => vals[i]!)}" fill="${ACCENT}" fill-opacity="0.16" stroke="${ACCENT}" stroke-width="${(size * 0.008).toFixed(1)}" stroke-linejoin="round"/></svg>`;
  const font = Math.round(size * 0.042);
  const box = font * 7;
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} alt="" width={size} height={size} style={{ width: size, height: size }} />
      {points.map((p, i) => {
        const [x, y] = at(i, 1.2);
        const align = Math.abs(x - c) < 4 ? "center" : x > c ? "left" : "right";
        const left = align === "center" ? x - box / 2 : align === "left" ? x : x - box;
        return (
          <div
            key={p.axis}
            style={{ display: "flex", position: "absolute", left, top: y - font * 0.62, width: box, justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end", fontSize: font, color: i === strongest ? INK : MUTED }}
          >
            {p.axis}
          </div>
        );
      })}
    </div>
  );
}

/**
 * GET /api/taste/card?format=story|wide — your taste as an image to share: your Taste DNA, the
 * radar, your three highest-rated titles (never one hidden from friends), your eras and a QR code
 * for your invite link (so whoever sees it can compare with you). Personal, so it's made on
 * request and never cached.
 */
export const GET = route({ auth: "required", rateLimit: { name: "taste-card", limit: 20, windowSec: 60 } }, async ({ user, req }) => {
  const format = new URL(req.url).searchParams.get("format") === "wide" ? "wide" : "story";
  const { w: W, h: H } = FORMATS[format];
  const me = await ensureIdentity(user.uid);
  if (!me?.inviteCode) throw notFound("No profile yet. Sign in again to create it.");
  const person = toPerson(me);
  const url = inviteUrl(me.inviteCode);
  const [taste, timeline, top, qr, fonts] = await Promise.all([
    getFreshProfile(user.uid).then(toTasteView),
    getTimeline(user.uid),
    shareTopTitles(user.uid).then((ts) => Promise.all(ts.map(async (t) => ({ ...t, src: await posterData(t.posterPath) })))),
    inviteQrSvg(url, "#141210"),
    ogFonts(),
  ]);
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`;
  const dna = taste.dna.length ? taste.dna.slice(0, 3) : ["Still learning what they love"];
  const covers = top.filter((t) => t.src);
  // The story has room for the top three or four eras, not both.
  const eras = timeline.eras.slice(covers.length ? -2 : -4).reverse();
  const stats = [
    [String(timeline.stats.titles), "titles"],
    [String(timeline.stats.hours), "hours"],
    [String(timeline.eras.length), timeline.eras.length === 1 ? "era" : "eras"],
  ];
  const first = person.name.split(" ")[0] ?? person.name;
  const link = url.replace(/^https?:\/\//, "");
  const headers = { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="reverie-taste-${format}.png"` };

  const qrBlock = (size: number) => (
    <div style={{ display: "flex", padding: size * 0.1, background: INK, borderRadius: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} alt="" width={size} height={size} style={{ width: size, height: size }} />
    </div>
  );
  const posters = (w: number, gap: number) => (
    <div style={{ display: "flex", gap }}>
      {covers.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={t.key} src={t.src!} alt="" width={w} height={w * 1.5} style={{ width: w, height: w * 1.5, borderRadius: 4 }} />
      ))}
    </div>
  );

  if (format === "wide") {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: W, height: H, padding: "56px 64px", background: "#0c0b0a", color: INK, fontFamily: "Instrument Sans", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 30, color: ACCENT }}>Reverie</div>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 3, color: MUTED, marginTop: 28 }}>{`${first.toUpperCase()}’S TASTE DNA`}</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 12, borderTop: `1px solid ${HAIRLINE}` }}>
              {dna.map((p) => (
                <div key={p} style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 40, lineHeight: 1.1, padding: "12px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
                  {p}
                </div>
              ))}
            </div>
            {covers.length ? <div style={{ display: "flex", marginTop: 24 }}>{posters(84, 12)}</div> : null}
            <div style={{ display: "flex", gap: 36, marginTop: "auto" }}>
              {stats.map(([v, k]) => (
                <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", fontSize: 34 }}>{v}</div>
                  <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", width: 330 }}>
            <Radar points={taste.radar} size={330} />
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {qrBlock(92)}
              <div style={{ display: "flex", flexDirection: "column", width: 190 }}>
                <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 26, lineHeight: 1.05 }}>Scan to compare tastes.</div>
                <div style={{ display: "flex", fontSize: 15, color: MUTED, marginTop: 8 }}>{link}</div>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H, fonts, headers },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          padding: "96px 88px 88px",
          background: "#0c0b0a",
          backgroundImage: "radial-gradient(circle at 80% 8%, rgba(232,162,58,0.18), rgba(12,11,10,0) 52%)",
          color: INK,
          fontFamily: "Instrument Sans",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 44, color: ACCENT }}>Reverie</div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>MY TASTE</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: person.name.length > 16 ? 76 : 96, lineHeight: 1, marginTop: 72 }}>{person.name}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: covers.length ? 24 : 36 }}>
          <Radar points={taste.radar} size={covers.length ? 480 : 600} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, borderTop: `1px solid ${HAIRLINE}` }}>
          {dna.map((p) => (
            <div key={p} style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 52, lineHeight: 1.08, padding: "18px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
              {p}
            </div>
          ))}
        </div>
        {covers.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>TOP RATED</div>
            <div style={{ display: "flex", marginTop: 14 }}>{posters(150, 20)}</div>
          </div>
        ) : null}
        {eras.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>MY ERAS</div>
            {eras.map((e) => (
              <div key={e.start} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
                <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 38 }}>{e.name}</div>
                <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{monthYear(e.start)}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40, marginTop: "auto" }}>
          {qrBlock(200)}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: 8 }}>
            <div style={{ display: "flex", gap: 32 }}>
              {stats.map(([v, k]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 44 }}>{v}</div>
                  <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{k}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 42, lineHeight: 1.05, marginTop: 28 }}>Scan to compare tastes.</div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED, marginTop: 10 }}>{link}</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers },
  );
});
