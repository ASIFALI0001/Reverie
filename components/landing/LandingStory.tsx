import { MatchRing } from "@/components/title/MatchRing";
import { StoryMotion } from "@/components/landing/StoryMotion";
import { OnFirstScroll } from "@/components/landing/OnFirstScroll";
import { tmdbImgUrl } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import type { ShowcasePoster } from "@/lib/catalog/showcase";

const BEATS = [
  "Every film you’ve loved leaves a trace.",
  "Reverie reads it: the pace, the tone, the people behind the camera.",
  "Then it holds every title up to your taste. Warm for you, cool for not.",
  "So you know you’ll love it before you press play.",
];

const COLS = 7;
const ROWS = 5;
const FEATURE_MATCH = 94;
/** A 1×1 transparent GIF: the wall's posters load as the story is approached (see StoryMotion). */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Deterministic: which posters glow warm (≈40%), and each poster's depth layer. */
const warm = (i: number) => (i * 7 + 3) % 5 < 2;
const layer = (i: number) => (i * 5 + Math.floor(i / COLS)) % 3;

/**
 * The landing's scroll story (brief §9.3 #5): a pinned poster wall that tilts,
 * separates into depth layers, splits warm/cool, then sends one poster forward
 * with its match. Server-rendered; StoryMotion attaches the scrubbed timeline.
 */
export function LandingStory({ posters }: { posters: ShowcasePoster[] }) {
  const wall = Array.from({ length: COLS * ROWS }, (_, i) => posters[i % Math.max(1, posters.length)]).filter(Boolean) as ShowcasePoster[];
  if (!wall.length) return null;
  const featureIndex = wall.findIndex((_, i) => warm(i) && i >= Math.floor(wall.length / 2));
  const feature = wall[featureIndex >= 0 ? featureIndex : 0]!;

  return (
    <section data-story aria-label="How Reverie learns your taste" className="relative">
      <StoryMotion />

      {/* With motion: the pinned scene. */}
      <div data-stage className="relative h-[100svh] overflow-hidden [perspective:1400px] motion-reduce:hidden">
        <div
          data-wall
          className="absolute left-1/2 top-1/2 grid w-[min(118vw,96rem)] -translate-x-1/2 -translate-y-1/2 grid-cols-7 gap-3 [transform-style:preserve-3d] md:gap-4"
        >
          {wall.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              data-layer={layer(i)}
              data-tone={warm(i) ? "warm" : "cool"}
              className="relative aspect-[2/3] overflow-hidden rounded-[2px] bg-surface shadow-[0_24px_48px_-24px_rgb(0_0_0/0.9)] [transform-style:preserve-3d]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static, lazy, fixed-size thumbnails: no optimizer, no hydration */}
              <img
                src={BLANK}
                data-src={tmdbImgUrl(p.posterPath, "w185")!}
                data-opacity="0.8"
                alt=""
                width={185}
                height={278}
                decoding="async"
                className="size-full object-cover opacity-0 transition-opacity duration-500"
              />
              {warm(i) ? (
                <span
                  data-warm
                  aria-hidden="true"
                  className="invisible absolute inset-0 bg-[color-mix(in_oklab,var(--color-accent)_30%,transparent)] opacity-0 ring-2 ring-inset ring-[color-mix(in_oklab,var(--color-accent)_75%,transparent)]"
                />
              ) : (
                <span data-cool aria-hidden="true" className="invisible absolute inset-0 bg-[rgb(12_18_28/0.72)] opacity-0" />
              )}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-8 pb-[14svh] md:gap-14 md:pb-0">
          <div className="relative">
            <div data-feature className="invisible relative aspect-[2/3] w-[min(46vw,17rem)] overflow-hidden rounded-[2px] opacity-0 shadow-[0_60px_120px_-30px_rgb(0_0_0/0.95)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BLANK}
                data-src={tmdbImgUrl(feature.posterPath, "w342")!}
                data-opacity="1"
                alt=""
                width={342}
                height={513}
                decoding="async"
                className="size-full object-cover opacity-0 transition-opacity duration-500"
              />
            </div>
            {/* Phones: the dial rides the poster's corner like a sticker. */}
            <div data-feature-ring className="invisible absolute -right-12 -top-12 opacity-0 md:hidden">
              <OnFirstScroll><MatchRing value={FEATURE_MATCH} delay={0} className="w-[7.5rem]" /></OnFirstScroll>
            </div>
          </div>
          <div data-feature-ring className="invisible hidden opacity-0 md:block">
            <OnFirstScroll><MatchRing value={FEATURE_MATCH} note="Your match" delay={0} className="w-[clamp(10rem,16vw,14rem)]" /></OnFirstScroll>
          </div>
        </div>

        {/* Legibility for the beats over a busy wall. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-bg via-bg/70 to-transparent" />
        <div className="page pointer-events-none absolute inset-x-0 bottom-[12svh]">
          <div className="relative min-h-[7.5rem] max-w-[22ch] md:max-w-[26ch]">
            {BEATS.map((beat, i) => (
              <p
                key={beat}
                data-beat={i}
                className={cn("absolute inset-x-0 bottom-0 font-display text-[clamp(1.75rem,4vw,3.25rem)] leading-[1.05]", i > 0 && "invisible opacity-0")}
              >
                {beat}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Reduced motion: the same story, told standing still. */}
      <div className="page hidden py-[var(--section-y)] motion-reduce:block">
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
          <ol className="space-y-6">
            {BEATS.map((beat) => (
              <li key={beat} className="font-display text-[clamp(1.5rem,3vw,2.5rem)] leading-tight">
                {beat}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-8">
            <div className="relative aspect-[2/3] w-40 overflow-hidden rounded-[2px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BLANK}
                data-src={tmdbImgUrl(feature.posterPath, "w342")!}
                data-opacity="1"
                alt=""
                width={160}
                height={240}
                decoding="async"
                className="size-full object-cover opacity-0 transition-opacity duration-500"
              />
            </div>
            <OnFirstScroll><MatchRing value={FEATURE_MATCH} note="Your match" delay={0} className="w-40" /></OnFirstScroll>
          </div>
        </div>
      </div>
    </section>
  );
}
