import type { Metadata } from "next";
import Image from "next/image";
import { PageTransition } from "@/components/motion/PageTransition";

export const metadata: Metadata = {
  title: "Streaming sites",
  description: "Official streaming services, one click away.",
  alternates: { canonical: "/streaming" },
};

type Site = {
  /** Shown under the logo. */
  name: string;
  /** Where the card goes (opens in a new tab). */
  url: string;
  /** The logo's file name in public/streaming-logos/. */
  logo: string;
};

/*
 * ─── THE SITES ───────────────────────────────────────────────────────────────
 * One card per line, shown in this order. To add a site:
 *   1. Put its logo in public/streaming-logos/ (square, about 300×300; PNG, JPG, SVG or WebP).
 *   2. Copy any line below, then change the name, the link and the logo's file name.
 * Nothing else needs to change.
 */
const SITES: Site[] = [
  { name: "Netflix", url: "https://www.netflix.com/", logo: "netflix.png" },
  { name: "Prime Video", url: "https://www.primevideo.com/", logo: "prime-video.png" },
  { name: "JioHotstar", url: "https://www.hotstar.com/", logo: "jiohotstar.png" },
  { name: "HBO Max", url: "https://www.hbomax.com/", logo: "hbo-max.png" },
  { name: "321-Movies", url: "https://321movies.xyz/", logo: "321.png" },
  { name: "7-Reels", url: "https://7reels.cc/", logo: "7reels.png" },
  { name: "Aether", url: "https://aether.st/", logo: "aether.png" },
  { name: "Apex-Movies", url: "https://apexmovies.net/", logo: "apex.png" },
  { name: "Freekz", url: "https://freekz.to/", logo: "freek.png" },
  { name: "Binge-Flix", url: "https://bingeflix.tv/", logo: "bingeflix.png" },
  { name: "CineJoy", url: "https://cinejoy.pk/", logo: "cinejoy.png" },
  { name: "Cinema", url: "https://cinema.army/", logo: "cinema.png" },
  { name: "Cinewave", url: "https://watch.cinewave.qzz.io/", logo: "cinewave.png" },
  { name: "Koddo", url: "https://koddo.to/en", logo: "koddo.png" },
  { name: "Corn-Click", url: "https://cornclick.com/", logo: "cornclick.png" },
  { name: "DashFlix", url: "https://dashflix.top/", logo: "dashflix.png" },
  { name: "Donkey", url: "https://donkey.to/", logo: "donkey.png" },
  { name: "DuaFile", url: "https://download.duafile.com/", logo: "duafile.png" },
  { name: "Filmex", url: "https://filmex.to/", logo: "filmex.png" },
  { name: "FilkyStream", url: "https://flickystream.mov/", logo: "flicky.png" },
  { name: "HeartLivePlay", url: "https://heartiveplaystv.pages.dev/", logo: "heartlive.png" },
];

export default function StreamingSitesPage() {
  return (
    <PageTransition>
      <article className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
        <header className="max-w-[44rem]">
          <p className="caption text-muted">Watch</p>
          <h1 className="mt-3 text-h1">Streaming sites</h1>
          <p className="mt-6 text-lead text-text/90">Official services, one click away. Each opens in a new tab.</p>
        </header>

        <ul className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {SITES.map((site) => (
            <li key={site.name}>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center gap-5 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-8 text-center transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-hairline-strong"
              >
                <Image
                  src={`/streaming-logos/${site.logo}`}
                  alt=""
                  width={88}
                  height={88}
                  className="size-[clamp(4.5rem,9vw,5.5rem)] rounded-[22%] object-cover shadow-[0_14px_34px_rgb(0_0_0/0.3)] transition-transform duration-300 group-hover:scale-[1.04]"
                />
                <span className="font-display text-h4">{site.name}</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-meta text-muted">
          What each service carries depends on your country. A title’s page shows where it’s streaming for you. Names and logos belong to their owners.
        </p>
      </article>
    </PageTransition>
  );
}