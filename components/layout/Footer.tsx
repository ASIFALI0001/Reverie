import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { FooterAccountLinks } from "@/components/layout/FooterAccountLinks";

const EXPLORE = [
  { href: "/search", label: "Search" },
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/streaming", label: "Streaming sites" },
  { href: "/about", label: "About Reverie" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="mt-[var(--section-y)] border-t border-hairline">
      <div className="page grid-editorial gap-y-12 py-14 md:py-20">
        <div className="col-span-12 md:col-span-5">
          <p className="font-display text-h3 leading-[1.02]">
            Know you’ll love it
            <br />
            before you press <em>play.</em>
          </p>
        </div>

        <nav aria-label="Explore" className="col-span-6 md:col-span-2 md:col-start-7">
          <ul className="space-y-2.5">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} transitionTypes={["nav"]} className="link-draw text-muted hover:text-text">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account" className="col-span-6 md:col-span-2">
          <FooterAccountLinks />
        </nav>

        <div className="col-span-12 space-y-3 text-meta text-muted md:col-span-2">
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
            <img src="/brand/tmdb-alt-short.svg" alt="The Movie Database (TMDB)" width={150} height={20} loading="lazy" decoding="async" className="h-3.5 w-auto" />
          </a>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          <p>Where-to-watch data is provided by JustWatch.</p>
        </div>
      </div>

      <div className="page flex flex-col gap-2 border-t border-hairline py-6 text-meta text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <LogoMark size={16} /> Reverie, 2026
          {LEGAL_LINKS.map((l) => (
            <span key={l.href} className="contents">
              <span aria-hidden="true">·</span>
              <Link href={l.href} className="link-draw hover:text-text">
                {l.label}
              </Link>
            </span>
          ))}
        </span>
        <span>Reverie doesn’t host or stream video. Every watch link goes to an official service.</span>
      </div>
    </footer>
  );
}
