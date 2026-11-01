import { ImageResponse } from "next/og";
import { ensureTitle } from "@/lib/catalog/ensure";
import { titleKey } from "@/lib/catalog/types";
import { tmdbImgUrl } from "@/lib/images/tmdb";
import { matchColorHex } from "@/lib/match-color";
import { formatRuntime } from "@/lib/format";
import { ogFonts } from "@/lib/og/fonts";

const W = 1200;
const H = 630;

/**
 * GET /api/og/:mediaType/:id[?m=87] — the share card: backdrop, poster, title and
 * ratings, plus "Your match" when a share link carries one. Crawlers can't see
 * personal data, so the match only ever comes from the link itself.
 */
export async function GET(req: Request, { params }: { params: Promise<{ mediaType: string; id: string }> }) {
  const { mediaType, id } = await params;
  const tmdbId = Number(id);
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return new Response("Not found", { status: 404 });
  }
  const m = Number(new URL(req.url).searchParams.get("m"));
  const match = Number.isInteger(m) && m >= 1 && m <= 99 ? m : null;

  const doc = await ensureTitle(titleKey(mediaType, tmdbId), { enrich: false, jikan: false });
  if (!doc) return new Response("Not found", { status: 404 });

  const backdrop = tmdbImgUrl(doc.backdropPath, "w1280");
  const poster = tmdbImgUrl(doc.posterPath, "w500");
  const meta = [doc.year, doc.mediaType === "movie" ? formatRuntime(doc.runtime) : doc.seasons ? `${doc.seasons} seasons` : null, doc.genres.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join("  ·  ");
  const ratings = [
    doc.ratings.imdb ? ["IMDb", String(doc.ratings.imdb)] : null,
    doc.ratings.rottenTomatoes != null ? ["Rotten Tomatoes", `${doc.ratings.rottenTomatoes}%`] : null,
    doc.ratings.metacritic != null ? ["Metacritic", String(doc.ratings.metacritic)] : null,
  ].filter((x): x is string[] => x != null);
  const ring = match != null ? matchColorHex(match) : null;
  const circumference = 2 * Math.PI * 64;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: W, height: H, background: "#0c0b0a", color: "#ede6da", fontFamily: "Instrument Sans", position: "relative" }}>
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", opacity: 0.38 }} />
        ) : null}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(12,11,10,1) 0%, rgba(12,11,10,0.94) 48%, rgba(12,11,10,0.6) 100%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 56, padding: "64px 72px", position: "relative", width: "100%" }}>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" width={300} height={450} style={{ width: 300, height: 450, objectFit: "cover", borderRadius: 3, boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }} />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 26, color: "#e8a23a", fontFamily: "Instrument Serif", letterSpacing: 0.5 }}>Reverie</div>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: doc.title.length > 22 ? 70 : 92, lineHeight: 0.98, marginTop: 18, maxWidth: 640 }}>
              {doc.title}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#8a8378", marginTop: 20 }}>{meta}</div>
            <div style={{ display: "flex", gap: 40, marginTop: 36 }}>
              {ratings.map(([label, value]) => (
                <div key={label} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 18, color: "#8a8378" }}>{label}</div>
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 500, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
          {match != null && ring ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", position: "relative", width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
                <svg width="150" height="150" viewBox="0 0 150 150" style={{ position: "absolute", top: 0, left: 0 }}>
                  <circle cx="75" cy="75" r="64" fill="none" stroke="rgba(237,230,218,0.16)" strokeWidth="3" />
                  <circle
                    cx="75"
                    cy="75"
                    r="64"
                    fill="none"
                    stroke={ring}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(match / 100) * circumference} ${circumference}`}
                    transform="rotate(-90 75 75)"
                  />
                </svg>
                <div style={{ display: "flex", fontSize: 58, fontWeight: 400 }}>{match}%</div>
              </div>
              <div style={{ display: "flex", fontSize: 20, color: "#8a8378", marginTop: 14 }}>Your match</div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: await ogFonts(),
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" },
    },
  );
}
