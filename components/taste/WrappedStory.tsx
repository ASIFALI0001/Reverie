"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise, CaretLeft, CaretRight, Pause, Play, X } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CountUp } from "@/components/motion/CountUp";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ShareTasteButton } from "@/components/taste/ShareTaste";
import { useWrapped, type WrappedView } from "@/lib/api/timeline";
import { useQueryParam } from "@/lib/hooks/use-query-param";
import { tmdbImg } from "@/lib/images/tmdb";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";

type Range = { from: string; to: string };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The whole year from mid-December, last year until mid-January, otherwise this year so far. */
export function defaultRange(today = new Date()): Range {
  const [y, m, d] = [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()];
  if (m === 0 && d <= 15) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (m === 11 && d >= 15) return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: `${y}-01-01`, to: iso(today) };
}

function presets(today = new Date()): (Range & { label: string })[] {
  const y = today.getUTCFullYear();
  return [
    { label: `${y} so far`, from: `${y}-01-01`, to: iso(today) },
    { label: String(y - 1), from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: "Last 12 months", from: iso(new Date(Date.UTC(y - 1, today.getUTCMonth(), today.getUTCDate() + 1))), to: iso(today) },
  ];
}

const monthName = (iso: string, style: "long" | "short" | "narrow" = "long") => new Date(iso).toLocaleDateString("en-GB", { month: style, timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function WrappedStory() {
  return (
    <AuthGuard fallback={<StorySkeleton />}>
      <Story />
    </AuthGuard>
  );
}

function Story() {
  const qFrom = useQueryParam("from");
  const qTo = useQueryParam("to");
  const [picked, setPicked] = useState<Range | null>(null);
  const fromUrl = qFrom && qTo && DAY.test(qFrom) && DAY.test(qTo) && qFrom <= qTo ? { from: qFrom, to: qTo } : null;
  const range = picked ?? fromUrl ?? defaultRange();
  const wrapped = useWrapped(range.from, range.to);

  function choose(r: Range) {
    setPicked(r);
    window.history.replaceState(null, "", `/taste/wrapped?from=${r.from}&to=${r.to}`);
  }

  if (wrapped.isPending) return <StorySkeleton />;
  if (wrapped.isError) {
    return (
      <Frame label="Wrapped">
        <div className="flex h-full flex-col justify-center p-8">
          <p className="font-display text-h3">Your Wrapped didn’t load.</p>
          <p className="mt-3 text-muted">Check your connection and try again.</p>
          <Button className="mt-6 self-start" onClick={() => wrapped.refetch()}>
            Try again
          </Button>
        </div>
      </Frame>
    );
  }
  return <Slides key={`${range.from}:${range.to}`} w={wrapped.data} range={range} onRange={choose} />;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

type SlideDef = { id: string; label: string; ms: number; glow: string; body: ReactNode };

function Slides({ w, range, onRange }: { w: WrappedView; range: Range; onRange: (r: Range) => void }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const slides = buildSlides(w, range, onRange, () => go(0));
  const n = slides.length;
  const playing = !paused && !hidden;
  const slide = slides[Math.min(i, n - 1)]!;

  function go(to: number) {
    const next = Math.max(0, Math.min(n - 1, to));
    setDir(next >= i ? 1 : -1);
    setI(next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [role='dialog']")) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === " " || e.key === "k") setPaused((p) => !p);
      else if (e.key === "Escape") router.push("/taste");
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Frame label={`Your ${w.range.label}, wrapped`} glow={slide.glow}>
      <h1 className="sr-only">Your {w.range.label}, wrapped</h1>
      {/* Progress: one segment per slide; the current one fills while it plays, then the story moves on. */}
      <div aria-hidden="true" className="absolute inset-x-4 top-4 z-30 flex gap-1">
        {slides.map((s, k) => (
          <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-text/20">
            {k < i ? (
              <span className="block size-full bg-text" />
            ) : k === i ? (
              <span
                key={`active-${i}`}
                className="story-fill block size-full bg-text"
                style={{ "--story-ms": `${s.ms}ms`, animationPlayState: playing ? "running" : "paused" } as CSSProperties}
                onAnimationEnd={() => (i < n - 1 ? go(i + 1) : setPaused(true))}
              />
            ) : null}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-4 top-8 z-30 flex items-center justify-between">
        <p className="caption text-muted">Reverie · {w.range.label}</p>
        <Link href="/taste" aria-label="Close Wrapped" className="pointer-events-auto grid size-10 place-items-center rounded-full text-text hover:bg-text/10">
          <X size={20} weight="light" aria-hidden="true" />
        </Link>
      </div>

      {/* Tap the left third to go back, anywhere else to go on (the buttons below do the same). */}
      <div aria-hidden="true" className="absolute inset-y-0 left-0 z-0 w-[30%]" onClick={() => go(i - 1)} />
      <div aria-hidden="true" className="absolute inset-y-0 right-0 z-0 w-[70%]" onClick={() => go(i + 1)} />

      {/* `custom` hands the newest direction to the slide that's leaving, too. */}
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={slide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${n}: ${slide.label}`}
          custom={dir}
          variants={{
            enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 36 }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * -36 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduced ? 0.2 : 0.55, ease: ease.out }}
          className="pointer-events-none absolute inset-0 z-10 flex flex-col px-7 pb-24 pt-20 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto"
        >
          {slide.body}
        </motion.div>
      </AnimatePresence>

      <p aria-live={playing && !reduced ? "off" : "polite"} className="sr-only">
        Slide {i + 1} of {n}: {slide.label}
      </p>
      <div className="absolute inset-x-4 bottom-4 z-30 flex items-center justify-between">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide" className="grid size-11 place-items-center rounded-full text-text hover:bg-text/10 disabled:opacity-30">
          <CaretLeft size={20} weight="light" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play" : "Pause"}
          className={cn("grid size-11 place-items-center rounded-full text-text hover:bg-text/10", reduced && "invisible")}
        >
          {paused ? <Play size={18} weight="fill" aria-hidden="true" /> : <Pause size={18} weight="fill" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Next slide" className="grid size-11 place-items-center rounded-full text-text hover:bg-text/10 disabled:opacity-30">
          <CaretRight size={20} weight="light" aria-hidden="true" />
        </button>
      </div>
    </Frame>
  );
}

/** The story's frame: full screen on phones, a tall card on wider screens. */
function Frame({ label, glow = "20% 12%", children }: { label: string; glow?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg md:py-[4dvh]">
      <section
        aria-roledescription="story"
        aria-label={label}
        className="relative h-dvh w-full max-w-[30rem] overflow-hidden bg-surface transition-[background-position] duration-1000 md:h-[92dvh] md:rounded-[10px] md:border md:border-hairline"
        style={{
          backgroundImage: `radial-gradient(circle at ${glow}, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 62%)`,
        }}
      >
        {children}
      </section>
    </div>
  );
}

/** Lines that rise in one after another (as list items inside lists). */
function Rise({ delay = 0, as = "div", className, children }: { delay?: number; as?: "div" | "li"; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: ease.out, delay: 0.15 + delay }}
    >
      {children}
    </Tag>
  );
}

const big = "font-display text-[clamp(2.75rem,11vw,4.25rem)] leading-[0.95]";

function buildSlides(w: WrappedView, range: Range, onRange: (r: Range) => void, replay: () => void): SlideDef[] {
  if (!w.titles) {
    return [
      {
        id: "empty",
        label: "Nothing logged yet",
        ms: 60_000,
        glow: "50% 30%",
        body: (
          <div className="flex h-full flex-col justify-center">
            <Rise>
              <p className={big}>Nothing logged in {w.range.label}.</p>
            </Rise>
            <Rise delay={0.15}>
              <p className="mt-5 text-[1.0625rem] text-muted">Add what you watched (with when you watched it), or look at another stretch of time.</p>
            </Rise>
            <RangePicker range={range} onRange={onRange} className="mt-8" />
          </div>
        ),
      },
    ];
  }

  const slides: SlideDef[] = [
    {
      id: "intro",
      label: "Your year in titles",
      ms: 5500,
      glow: "18% 10%",
      body: (
        <div className="flex h-full flex-col justify-end">
          <Rise>
            <p className="caption text-muted">Wrapped</p>
          </Rise>
          <Rise delay={0.1}>
            <p aria-hidden="true" className="mt-3 font-display text-[clamp(3.25rem,14vw,5.5rem)] leading-[0.9]">
              Your {w.range.label}, <em>wrapped.</em>
            </p>
          </Rise>
          <Rise delay={0.3}>
            <p className="mt-6 text-[1.125rem] text-text/90">{plural(w.titles, "title")} worth of evenings. Here’s what they said about you.</p>
          </Rise>
        </div>
      ),
    },
    {
      id: "numbers",
      label: "In numbers",
      ms: 6500,
      glow: "85% 20%",
      body: (
        <div className="flex h-full flex-col justify-center gap-8">
          <Rise>
            <p className="text-meta text-muted">You logged</p>
            <p className={cn(big, "numeral")}>
              <CountUp value={w.titles} /> titles
            </p>
          </Rise>
          <Rise delay={0.2}>
            <p className="text-meta text-muted">That’s about</p>
            <p className={cn(big, "numeral")}>
              <CountUp value={w.hours} delay={0.2} /> hours
            </p>
          </Rise>
          <Rise delay={0.4}>
            <p className="text-[1.0625rem] text-text/90">
              {plural(w.films, "film")} and {plural(w.series, "series", "series")}
              {w.avgRating != null ? `, rated ★ ${(w.avgRating / 2).toFixed(1)} on average` : ""}.
            </p>
          </Rise>
        </div>
      ),
    },
  ];

  if (w.first) {
    const first = w.first;
    slides.push({
      id: "first",
      label: "Where it started",
      ms: 6000,
      glow: "30% 70%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">It started on {new Date(first.at).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })} with</p>
          </Rise>
          {first.posterPath ? (
            <Rise delay={0.15} className="mt-6">
              <Poster card={first} className="w-[min(46vw,11rem)] -rotate-2" priority />
            </Rise>
          ) : null}
          <Rise delay={0.3}>
            <p className="mt-6 font-display text-[clamp(2.25rem,9vw,3.25rem)] leading-[1]">{first.title}</p>
          </Rise>
        </div>
      ),
    });
  }

  if (w.months.length > 1 && w.busiest) {
    const busiest = w.busiest;
    slides.push({
      id: "months",
      label: "Your busiest month",
      ms: 7000,
      glow: "70% 80%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">Your busiest month</p>
            <p className={cn(big, "mt-2")}>{monthName(busiest.start)}</p>
            <p className="mt-3 text-[1.0625rem] text-text/90">{plural(busiest.count, "title")} in one month.</p>
          </Rise>
          <Rise delay={0.2} className="mt-10">
            <MonthBars months={w.months} busiest={busiest.start} />
          </Rise>
        </div>
      ),
    });
  }

  if (w.topGenres.length) {
    slides.push({
      id: "genres",
      label: "What you watched most",
      ms: 7000,
      glow: "12% 60%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">Mostly, you were in the mood for</p>
          </Rise>
          <ol className="mt-6 space-y-5">
            {w.topGenres.map((g, k) => (
              <Rise key={g.term} as="li" delay={0.15 + k * 0.15} className="flex items-baseline gap-4 border-b border-hairline pb-4">
                <span className="numeral w-[4.5ch] font-display text-[clamp(2.25rem,9vw,3rem)] leading-none text-accent">
                  <CountUp value={g.share} delay={0.2 + k * 0.15} suffix="%" />
                </span>
                <span className="font-display text-[clamp(1.75rem,7vw,2.25rem)] leading-none">{g.word}</span>
              </Rise>
            ))}
          </ol>
        </div>
      ),
    });
  }

  if (w.vibe) {
    const v = w.vibe;
    slides.push({
      id: "feel",
      label: "How it felt",
      ms: 7000,
      glow: "60% 15%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">What you loved felt</p>
            <p className={cn(big, "mt-2")}>{w.feel.length ? w.feel.join(", ") : "just right"}.</p>
          </Rise>
          <div className="mt-10 space-y-6">
            {(
              [
                ["Pace", v.pace, "Slow-burn", "Fast"],
                ["Tone", v.tone, "Light", "Dark"],
                ["Complexity", v.complexity, "Easy", "Demanding"],
              ] as const
            ).map(([name, value, lo, hi], k) => (
              <Rise key={name} delay={0.2 + k * 0.12}>
                <Scale name={name} value={value} low={lo} high={hi} />
              </Rise>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (w.favourites.length) {
    slides.push({
      id: "favourites",
      label: "Your favourites",
      ms: 7500,
      glow: "50% 30%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">The ones you loved most</p>
          </Rise>
          <ol className="mt-6 grid grid-cols-3 gap-3">
            {w.favourites.slice(0, 6).map((f, k) => (
              <Rise key={f.key} as="li" delay={0.1 + k * 0.08}>
                <Poster card={f} className="w-full" />
                <p className="mt-2 truncate text-[0.875rem]">{f.title}</p>
                <p className="numeral text-meta text-muted">★ {f.rating / 2}</p>
              </Rise>
            ))}
          </ol>
        </div>
      ),
    });
  }

  if (w.eras.length) {
    slides.push({
      id: "eras",
      label: w.eras.length === 1 ? "Your era" : "Your eras",
      ms: 7000,
      glow: "85% 70%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">{w.eras.length === 1 ? "It was all one era" : `You went through ${w.eras.length} eras`}</p>
          </Rise>
          <ol className="mt-6 border-t border-hairline">
            {w.eras.map((e, k) => (
              <Rise key={e.start} as="li" delay={0.15 + k * 0.12} className="border-b border-hairline py-4">
                <p className="font-display text-[clamp(1.75rem,7vw,2.5rem)] leading-[1.02]">{e.name}</p>
                <p className="mt-1 text-meta text-muted">
                  from {monthName(e.start)} {new Date(e.start).getUTCFullYear()}
                </p>
              </Rise>
            ))}
          </ol>
        </div>
      ),
    });
  }

  if (w.dna.length) {
    slides.push({
      id: "dna",
      label: "Your Taste DNA",
      ms: 7000,
      glow: "20% 85%",
      body: (
        <div className="flex h-full flex-col justify-center">
          <Rise>
            <p className="text-meta text-muted">Which makes your Taste DNA</p>
          </Rise>
          <ul className="mt-6 border-t border-hairline">
            {w.dna.map((p, k) => (
              <Rise key={p} as="li" delay={0.15 + k * 0.12} className="border-b border-hairline py-3 font-display text-[clamp(1.75rem,7vw,2.5rem)] leading-[1.05]">
                {p}
              </Rise>
            ))}
          </ul>
        </div>
      ),
    });
  }

  slides.push({
    id: "outro",
    label: "That’s a wrap",
    ms: 60_000,
    glow: "50% 50%",
    body: (
      <div className="flex h-full flex-col justify-center">
        <Rise>
          <p className={big}>That’s your {w.range.label}.</p>
        </Rise>
        <Rise delay={0.15} className="mt-8 flex flex-wrap gap-2">
          <ShareTasteButton />
          <Button variant="ghost" onClick={replay}>
            <ArrowCounterClockwise size={18} weight="light" aria-hidden="true" /> Watch again
          </Button>
        </Rise>
        <Rise delay={0.3}>
          <RangePicker range={range} onRange={onRange} className="mt-10" />
        </Rise>
        <Rise delay={0.4}>
          <Link href="/taste" className="link-draw mt-8 inline-block text-meta text-muted hover:text-text">
            Back to your taste
          </Link>
        </Rise>
      </div>
    ),
  });
  return slides;
}

function Poster({ card, className, priority = false }: { card: { title: string; posterPath: string | null; href: string | null }; className?: string; priority?: boolean }) {
  const img = card.posterPath ? (
    <Image src={tmdbImg(card.posterPath)!} alt={card.title} fill sizes="(min-width: 768px) 11rem, 46vw" priority={priority} className="object-cover" />
  ) : null;
  const cls = cn("relative block aspect-[2/3] overflow-hidden rounded-[2px] bg-raised shadow-[0_18px_40px_rgb(0_0_0/0.35)]", className);
  return card.href ? (
    <Link href={card.href} className={cls}>
      {img}
    </Link>
  ) : (
    <span className={cls}>{img}</span>
  );
}

/** One bar per month, the busiest picked out in the accent with its count; a table for screen readers. */
function MonthBars({ months, busiest }: { months: WrappedView["months"]; busiest: string }) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...months.map((m) => m.count));
  const every = months.length > 12 ? 3 : 1;
  return (
    <figure>
      <div aria-hidden="true" className="flex h-36 items-end gap-[3px]">
        {months.map((m, k) => {
          const top = m.start === busiest;
          return (
            <div key={m.start} className="relative flex h-full flex-1 flex-col justify-end">
              {top ? <span className="numeral absolute -top-6 left-1/2 -translate-x-1/2 text-meta text-text">{m.count}</span> : null}
              <motion.span
                className={cn("block rounded-t-[4px]", top ? "bg-accent" : "bg-text/30")}
                style={{ height: `${Math.max(m.count ? 4 : 1, (m.count / max) * 100)}%`, transformOrigin: "bottom" }}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, ease: ease.out, delay: 0.3 + k * 0.03 }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-[3px]">
        {months.map((m, k) => (
          <span key={m.start} className="flex-1 text-center text-[0.6875rem] text-muted">
            {k % every === 0 ? monthName(m.start, "narrow") : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Titles logged each month</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.start}>
              <th scope="row">
                {monthName(m.start)} {new Date(m.start).getUTCFullYear()}
              </th>
              <td>{m.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A 0–1 scale with its two ends named; the reading is also given in words. */
function Scale({ name, value, low, high }: { name: string; value: number; low: string; high: string }) {
  const word = value <= 0.38 ? low.toLowerCase() : value >= 0.65 ? high.toLowerCase() : "in between";
  return (
    <div>
      <p className="flex justify-between text-meta">
        <span className="text-text">{name}</span>
        <span className="text-muted">{word}</span>
      </p>
      <div className="relative mt-2 h-[2px] rounded-full bg-text/20">
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent" style={{ left: `${Math.round(value * 100)}%` }} />
      </div>
      <p aria-hidden="true" className="mt-1.5 flex justify-between text-[0.6875rem] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  );
}

/** Any stretch of time: a few ready-made ones, or your own dates. */
function RangePicker({ range, onRange, className }: { range: Range; onRange: (r: Range) => void; className?: string }) {
  const [custom, setCustom] = useState(range);
  const options = presets();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (DAY.test(custom.from) && DAY.test(custom.to) && custom.from <= custom.to) onRange(custom);
  }
  return (
    <div className={className}>
      <p className="text-meta text-muted">Wrap another stretch</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={o.from === range.from && o.to === range.to}
            onClick={() => onRange(o)}
            className="rounded-full border border-hairline-strong px-3.5 py-1.5 text-[0.875rem] text-muted transition-colors hover:border-text/40 hover:text-text aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-bg"
          >
            {o.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-meta text-muted">
          From
          <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="mt-1 block h-10 rounded-[4px] border border-hairline-strong bg-transparent px-2 text-text" />
        </label>
        <label className="text-meta text-muted">
          To
          <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="mt-1 block h-10 rounded-[4px] border border-hairline-strong bg-transparent px-2 text-text" />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          Wrap these dates
        </Button>
      </form>
    </div>
  );
}

function StorySkeleton() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg md:py-[4dvh]" aria-hidden="true">
      <div className="relative h-dvh w-full max-w-[30rem] overflow-hidden bg-surface p-7 pt-20 md:h-[92dvh] md:rounded-[10px]">
        <div className="absolute inset-x-4 top-4 flex gap-1">
          {Array.from({ length: 9 }, (_, k) => (
            <span key={k} className="h-[3px] flex-1 rounded-full bg-text/15" />
          ))}
        </div>
        <Skeleton className="mt-[40dvh] h-14 w-4/5" />
        <Skeleton className="mt-4 h-14 w-3/5" />
        <Skeleton className="mt-8 h-5 w-2/3" />
      </div>
    </div>
  );
}
