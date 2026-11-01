import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { PosterCard } from "@/components/title/PosterCard";
import { MatchRing } from "@/components/title/MatchRing";
import { DemoHero } from "./DemoHero";
import { Playground } from "./Playground";

export const metadata: Metadata = { title: "Design language", robots: { index: false } };

const POSTERS = [
  { title: "Metropolis", year: 1927, meta: "2h 33m", src: "/demo/metropolis.jpg", color: "#b8946a", match: 87 },
  { title: "The Cabinet of Dr. Caligari", year: 1920, meta: "1h 16m", src: "/demo/caligari.jpg", color: "#8e4e6b", match: 81 },
  { title: "Sunrise", year: 1927, meta: "1h 34m", src: "/demo/sunrise.jpg", color: "#c98a4e", match: 92 },
  { title: "Battleship Potemkin", year: 1925, meta: "1h 15m", src: "/demo/potemkin.jpg", color: "#d9822b", match: 64 },
  { title: "The Gold Rush", year: 1925, meta: "1h 35m", src: "/demo/goldrush.jpg", color: "#b07a52", match: 48 },
  { title: "The General", year: 1926, meta: "1h 18m", src: "/demo/general.png", color: "#5f8f8a", match: 23 },
];

const SWATCHES = [
  { name: "bg", v: "--color-bg" },
  { name: "surface", v: "--color-surface" },
  { name: "raised", v: "--color-raised" },
  { name: "text", v: "--color-text" },
  { name: "muted", v: "--color-muted" },
  { name: "accent · tungsten", v: "--color-accent" },
  { name: "daylight", v: "--color-daylight" },
];

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <DemoHero />

      <section className="page py-[var(--section-y)]">
        <div className="grid-editorial gap-y-10">
          <p className="caption col-span-12 md:col-span-3">Design language — sample data on public-domain films</p>
          <div className="col-span-12 space-y-10 md:col-span-9">
            <SplitHeading className="text-h1">
              What will you <em>feel</em> tonight?
            </SplitHeading>
            <p className="max-w-[30ch] font-display text-lead">
              A city of machines and the people beneath it, told in light and shadow. Lang’s silent epic still sets the
              grammar for every dystopia since.
            </p>
            <p className="max-w-[62ch] text-muted">
              Body copy sits in Instrument Sans at a comfortable measure. Numbers — ratings, runtimes, match scores —
              switch to the mono face so columns align: <span className="numeral text-text">2h 33m · 8.3 · 97%</span>.
              Captions use true small caps, sparingly, only where they label data.
            </p>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-6 border-t border-hairline pt-8">
              <span className="text-display leading-none">Aa</span>
              <span className="font-display text-h2 italic">Aa</span>
              <span className="text-h3 font-medium">Aa</span>
              <span className="condensed text-h3 font-medium">Aa</span>
              <span className="numeral text-numeral font-extralight">87</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page border-t border-hairline py-[var(--section-y)]">
        <div className="grid-editorial gap-y-10">
          <h2 className="caption col-span-12 md:col-span-3">Palette</h2>
          <ul className="col-span-12 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-hairline bg-hairline sm:grid-cols-4 md:col-span-9 lg:grid-cols-7">
            {SWATCHES.map((s) => (
              <li key={s.name} className="bg-bg p-3">
                <div className="aspect-[3/4] rounded-[2px] border border-hairline" style={{ background: `var(${s.v})` }} />
                <p className="mt-3 text-meta">{s.name}</p>
                <p className="numeral text-[0.6875rem] text-muted">{s.v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page border-t border-hairline py-[var(--section-y)]">
        <div className="grid-editorial gap-y-10">
          <h2 className="caption col-span-12 md:col-span-3">Match, from daylight to tungsten</h2>
          <div className="col-span-12 flex flex-wrap gap-8 md:col-span-9">
            {[23, 54, 76, 94].map((v, i) => (
              <MatchRing key={v} value={v} delay={0.15 * i} className="w-[min(40vw,11rem)]" />
            ))}
          </div>
        </div>
      </section>

      <section className="page border-t border-hairline py-[var(--section-y)]">
        <div className="grid-editorial gap-y-10">
          <h2 className="caption col-span-12 md:col-span-3">Posters</h2>
          <ul className="col-span-12 grid grid-cols-2 gap-x-[var(--gutter)] gap-y-10 sm:grid-cols-3 md:col-span-9 lg:grid-cols-6">
            {POSTERS.map((p) => (
              <li key={p.title}>
                <PosterCard href="/design" title={p.title} year={p.year} meta={p.meta} posterSrc={p.src} color={p.color} match={p.match} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page border-t border-hairline py-[var(--section-y)]">
        <div className="grid-editorial gap-y-10">
          <h2 className="caption col-span-12 md:col-span-3">Controls</h2>
          <div className="col-span-12 md:col-span-9">
            <Playground />
          </div>
        </div>
      </section>
    </>
  );
}
