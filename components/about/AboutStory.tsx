import type { CSSProperties, ReactNode } from "react";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { AboutChrome, type ChapterMeta } from "@/components/about/AboutChrome";
import { LazyScene, type SceneName } from "@/components/about/LazyScene";
import type { AboutData } from "@/lib/about/data";
import { cn } from "@/lib/cn";

export const CHAPTERS: ChapterMeta[] = [
  { n: "00", label: "Reverie" },
  { n: "01", label: "Problem" },
  { n: "02", label: "Taste" },
  { n: "03", label: "Match" },
  { n: "04", label: "Why not" },
  { n: "05", label: "Search" },
  { n: "06", label: "Mood" },
  { n: "07", label: "Similar" },
  { n: "08", label: "Vibe" },
  { n: "09", label: "Series" },
  { n: "10", label: "Library" },
  { n: "11", label: "Timeline" },
  { n: "12", label: "Twins" },
  { n: "13", label: "Friends" },
  { n: "14", label: "Watch" },
  { n: "15", label: "Begin" },
];

/**
 * The About story: sixteen chapters, each one idea with its words rendered here (so they're in
 * the page for everyone, readers, crawlers and reduced motion alike) and its scene loaded when the
 * chapter comes near. Pinned chapters fill exactly one screen on wide displays; on phones every
 * chapter simply flows. A jump to a chapter lands a pixel inside it (-scroll-mt-px): exactly on
 * the edge, the browser anchors scrolling to the chapter above, and a scene arriving there then
 * pushes the one asked for out of view.
 */
export function AboutStory({ data }: { data: AboutData | null }) {
  return (
    <>
      <AboutChrome chapters={CHAPTERS} />
      {/* Room for the chapter rail lives in the page gutter, so full-bleed chapters still run edge to edge. */}
      <div className="lg:[--page-x:9.5rem]">
        <Opening data={data} />
        <Problem data={data} />
        <Chapter n="02" scene="taste" data={data} pin={180} title="Your taste, learned." copy="Swipe a few. Pick three favourites. Reverie learns what you love, and what you don’t." />
        <Chapter n="03" scene="match" data={data} pin={190} title="Every title gets a number made just for you." copy="What you’ve watched, the titles you loved that are most like it, its pace and tone, and a careful AI read: one honest number." />
        <Chapter n="04" scene="whyNot" data={data} pin={140} title="We’ll also tell you when something isn’t for you, and why." copy="Every reason rests on titles from your own history, so you can judge it for yourself." />
        <Chapter n="05" scene="ask" data={data} pin={170} title="Describe it like you’d tell a friend." copy="Plain words in, a ranked list out, each title with your match." />
        <Chapter
          n="06"
          scene="mood"
          data={data}
          pin={260}
          stacked
          title="Tell us how tonight feels. We’ll pick three."
          copy="A mood, how long you’ve got and who’s watching."
          stageStyle={{ ["--mood-a" as string]: "rgb(232 162 58 / 0)", ["--mood-b" as string]: "rgb(224 115 92 / 0)", background: "radial-gradient(circle at 22% 18%, var(--mood-a), transparent 60%), radial-gradient(circle at 82% 88%, var(--mood-b), transparent 60%)" }}
        />
        <Chapter n="07" scene="similar" data={data} pin={150} title="More like this, and why." copy="The closest first, each with six words on what they share." />
        <Chapter n="08" scene="vibe" data={data} stacked title="Watch the vibe before you commit." copy="IMDb, Rotten Tomatoes and Metacritic at a glance, then trailers, fan edits, reviews and explainers on the same page." />
        <Chapter n="09" scene="series" data={data} pin={150} stacked title="Bored on episode four? We’ll tell you if it gets better, without spoiling a thing." copy="The ratings ahead of you, read against your taste. Every reason checked for spoilers." />
        <Chapter n="10" scene="library" data={data} pin={220} stacked title="Your library, beautifully organised." copy="Movies, series, anime and cartoons, shelved by genre and franchise. Your watchlist ranks itself by match." />
        <Chapter n="11" scene="timeline" data={data} pin={230} stacked title="Watch your taste change." copy="Your eras, named. A radar that moves with you. A card to share, and every December, your year wrapped." />
        <Chapter n="12" scene="twins" data={data} pin={150} stacked title="Meet your Taste Twins." copy="The people whose taste is closest to yours, anonymous until you both say hello." />
        <Chapter n="13" scene="friends" data={data} stacked title="Better with friends." copy="Send a title with a note, keep a watchlist together, see where your tastes meet." after={<p className="mt-12 max-w-[46ch] font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">You choose what friends see. Hide anything, anytime.</p>} />
        <Chapter n="14" scene="watch" data={data} title="Straight to where it’s legally streaming." copy="Stream, rent or buy, in your region, from official provider data." />
        <Closing data={data} />
      </div>
    </>
  );
}

function Kicker({ n }: { n: string }) {
  const c = CHAPTERS.find((x) => x.n === n)!;
  return (
    <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
      {c.n} · {c.label}
    </p>
  );
}

function Chapter({
  n,
  scene,
  data,
  title,
  copy,
  pin,
  stacked = false,
  stageStyle,
  after,
}: {
  n: string;
  scene: SceneName;
  data: AboutData | null;
  title: string;
  copy: string;
  /** Pinned on wide screens: how far (in screen heights × 100) the scene scrubs while its stage holds. */
  pin?: number;
  /** Words above the scene, instead of beside it. */
  stacked?: boolean;
  stageStyle?: CSSProperties;
  after?: ReactNode;
}) {
  return (
    <section
      id={`ch-${n}`}
      data-chapter={n}
      aria-labelledby={`ch-${n}-title`}
      className={cn("relative -scroll-mt-px", pin && "about-pin")}
      style={pin ? ({ ["--pin" as string]: `${pin}svh` } as CSSProperties) : undefined}
    >
      <div
        data-stage
        style={stageStyle}
        className={cn(
          "page flex flex-col justify-center gap-10 py-[calc(var(--section-y)*0.9)]",
          pin && "motion-safe:lg:overflow-hidden lg:py-[calc(var(--nav-h)+2rem)]",
          !stacked && "lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16",
        )}
      >
        <header className={cn(stacked && "max-w-3xl")}>
          <Kicker n={n} />
          <SplitHeading as="h2" id={`ch-${n}-title`} className="mt-4 max-w-[20ch] text-[clamp(2.125rem,4.4vw,3.75rem)] leading-[1.02]">
            {title}
          </SplitHeading>
          <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted">{copy}</p>
        </header>
        <LazyScene name={scene} data={data} />
        {after}
      </div>
    </section>
  );
}

/** 00: the title writes itself (letters split here, drawn in by CSS, so it shows at first paint). */
function Opening({ data }: { data: AboutData | null }) {
  const word = "Reverie";
  return (
    <section id="ch-00" data-chapter="00" aria-labelledby="ch-00-title" className="about-pin relative" style={{ ["--pin" as string]: "120svh" } as CSSProperties}>
      <div data-stage className="relative flex h-svh flex-col items-center justify-center overflow-hidden">
        <LazyScene name="opening" data={data} eager className="!absolute inset-0" />
        <div className="relative px-[var(--page-x)] text-center">
          <h1 id="ch-00-title" aria-label={word} data-words className="font-display text-[clamp(4.5rem,15vw,12rem)] leading-[0.85]">
            {word.split("").map((ch, i) => (
              <span key={i} aria-hidden="true" className="about-letter inline-block" style={{ ["--i" as string]: i }}>
                {ch}
              </span>
            ))}
          </h1>
          <p data-words className="about-after mt-6 font-display text-[clamp(1.375rem,2.6vw,2rem)] italic text-text/90">
            Know you’ll love it before you press play.
          </p>
        </div>
        <p data-words aria-hidden="true" className="about-after absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted">
          <span className="about-scroll-line block h-12 w-px origin-top bg-text/60" />
          Scroll
        </p>
      </div>
    </section>
  );
}

/** 01: two lines over the streaming rows; the second takes over when everything stops. */
function Problem({ data }: { data: AboutData | null }) {
  return (
    <section id="ch-01" data-chapter="01" aria-labelledby="ch-01-title" className="about-pin relative -scroll-mt-px" style={{ ["--pin" as string]: "170svh" } as CSSProperties}>
      <div data-stage className="relative flex min-h-svh flex-col justify-between overflow-hidden py-[calc(var(--nav-h)+2rem)]">
        <LazyScene name="problem" data={data} className="!absolute inset-0" />
        <div className="page relative">
          <Kicker n="01" />
          <h2 id="ch-01-title" data-line="1" className="mt-4 max-w-[22ch] font-display text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.04]">
            Thousands of titles. Forty minutes of scrolling. Then you watch the same thing again.
          </h2>
        </div>
        <p data-line="2" className="page relative text-right font-display text-[clamp(2rem,4.2vw,3.5rem)] italic leading-[1.04]">
          What if you knew, before you pressed play?
        </p>
      </div>
    </section>
  );
}

/** 15: back to the dark, the way in, and the credits. */
function Closing({ data }: { data: AboutData | null }) {
  return (
    <section id="ch-15" data-chapter="15" aria-labelledby="ch-15-title" className="relative -scroll-mt-px">
      <div data-stage className="page flex min-h-svh flex-col items-center justify-center gap-[clamp(3rem,6vw,5rem)] py-[var(--section-y)] text-center">
        <div>
          <Kicker n="15" />
          <SplitHeading as="h2" id="ch-15-title" className="mx-auto mt-4 max-w-[14ch] text-[clamp(2.5rem,6vw,5rem)] leading-[0.98]">
            Your next favourite is waiting.
          </SplitHeading>
        </div>
        <LazyScene name="closing" data={data} />
        <p className="text-meta text-muted">Posters, ratings and providers from TMDB and JustWatch. Made by Asif.</p>
      </div>
    </section>
  );
}
