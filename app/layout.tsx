import type { Metadata, Viewport } from "next";
import { Chivo_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { InlineScript } from "@/components/fx/InlineScript";
import { CookieNotice } from "@/components/legal/CookieNotice";
import { Toaster } from "@/components/ui/Toaster";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-instrument-sans",
  display: "swap",
});

// Chivo Mono: one of the few Google monos whose zero is plain (no dot or slash), so small counts never read as 8.
const mono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-chivo-mono",
  display: "swap",
  // Numerals sit below the first screen on most pages; the metric-matched fallback covers the swap.
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Reverie — know you’ll love it before you press play",
    template: "%s · Reverie",
  },
  description:
    "Reverie learns your taste and tells you how much you’ll like any movie, series, anime or cartoon — with reasons — and where to watch it legally.",
  applicationName: "Reverie",
};

export const viewport: Viewport = {
  themeColor: "#0c0b0a",
  colorScheme: "dark light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <InlineScript html={themeBootScript} />
        {/* Posters and backdrops (often the LCP image) come from TMDB's CDN: open that connection with the HTML. */}
        {/* No crossorigin: plain <img> requests use a non-CORS connection, and that's the one to warm. */}
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Toaster />
        <CookieNotice />
        <div aria-hidden="true" className="grain" />
      </body>
    </html>
  );
}
