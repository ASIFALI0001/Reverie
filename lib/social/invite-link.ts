import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";

/** Your personal link: APP_URL/invite/<code>. */
export function inviteUrl(code: string): string {
  return new URL(`/invite/${code}`, env.siteUrl()).toString();
}

/**
 * The link as a QR code: an SVG in the given ink on a transparent ground, with no quiet zone
 * (the card around it provides one). Medium error correction survives a phone photo of a screen.
 */
export async function inviteQrSvg(url: string, ink = "#ede6da"): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: ink, light: "#0000" } });
}
