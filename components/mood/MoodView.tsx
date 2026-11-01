"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise, ArrowRight, BookmarkSimple, Check, Play, Shuffle } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { TrailerModal } from "@/components/ui/LazyDialogs";
import { MatchMini } from "@/components/title/MatchRing";
import { useToggleWatchlist } from "@/lib/api/library";
import { chooseMoodPick, useMoodOptions, useRunMood, useSwapMood, type Company, type MoodPick, type MoodResult, type MoodTime } from "@/lib/api/mood";
import { useSharedLists } from "@/lib/api/social";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { ease, spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { presetById } from "@/lib/mood/target";
import { useQueryParam } from "@/lib/hooks/use-query-param";

/** Each tile's light: two soft washes in the mood's own colours (never purple). */
const WASH: Record<string, [string, string]> = {
  "light-fun": ["232 162 58", "224 115 92"],
  "cant-sleep": ["43 74 122", "28 40 64"],
  "good-cry": ["109 138 168", "90 100 112"],
  "edge-of-seat": ["196 67 47", "70 20 14"],
  "make-me-think": ["47 143 134", "22 70 60"],
  "comfort-rewatch": ["184 148 106", "110 80 50"],
  "feel-inspired": ["240 160 75", "232 200 90"],
  "scare-me": ["143 29 29", "20 8 8"],
  romantic: ["201 138 128", "160 90 100"],
  background: ["147 170 140", "90 110 70"],
};

type Step = "mood" | "time" | "company" | "results";

export function MoodView() {
  return (
    <div className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <AuthGuard fallback={<MoodSkeleton />}>
        <MoodEntry />
      </AuthGuard>
    </div>
  );
}

/**
 * A mood chosen elsewhere (the Home card) arrives as ?preset= and starts at the time step. After a
 * client-side navigation the flow can render before the address bar has the new URL, so the
 * preset is read from the live query and the flow starts over once it arrives.
 */
function MoodEntry() {
  const param = useQueryParam("preset");
  const preset = presetById(param) ? param : null;
  return <MoodFlow key={preset ?? "none"} initialPreset={preset} />;
}

function MoodFlow({ initialPreset }: { initialPreset: string | null }) {
  const reduced = useReducedMotion();
  const options = useMoodOptions();
  const lists = useSharedLists();
  const run = useRunMood();
  const [step, setStep] = useState<Step>(initialPreset ? "time" : "mood");
  const [preset, setPreset] = useState<string | null>(initialPreset);
  const [text, setText] = useState("");
  const [time, setTime] = useState<MoodTime>("film");
  const [company, setCompany] = useState<Company | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [result, setResult] = useState<MoodResult | null>(null);

  const o = options.data;
  const moodName = preset ? (o?.presets.find((p) => p.id === preset)?.label ?? "") : text.trim();

  function go() {
    setStep("results");
    setResult(null);
    run.mutate(
      { preset, text: preset ? null : text.trim() || null, time, company, onlyMyServices: onlyMine },
      {
        onSuccess: setResult,
        onError: (err) => {
          toast({ title: "Couldn’t pick right now", description: err instanceof Error ? err.message : undefined, tone: "error" });
          setStep("company");
        },
      },
    );
  }

  function restart() {
    setStep("mood");
    setResult(null);
    setPreset(null);
    setText("");
  }

  const steps: { id: Exclude<Step, "results">; label: string }[] = [
    { id: "mood", label: "Mood" },
    { id: "time", label: "Time" },
    { id: "company", label: "Company" },
  ];
  const order = ["mood", "time", "company", "results"] as const;
  const at = order.indexOf(step);
  const fade = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div>
          <p className="caption">Mood</p>
          <h1 className="mt-2 max-w-[14ch] text-h1">What’s your mood tonight?</h1>
          <p className="mt-4 max-w-[46ch] text-muted">Tell Reverie how you feel and how long you’ve got. Three picks, made for right now and for your taste.</p>
        </div>
        {step !== "results" ? (
          <ol aria-label="Steps" className="flex items-center gap-2 text-meta">
            {steps.map((s, i) => {
              const done = i < at;
              const current = s.id === step;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  {i ? <span aria-hidden="true" className="h-px w-5 bg-hairline-strong" /> : null}
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => setStep(s.id)}
                    aria-current={current ? "step" : undefined}
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors", current ? "bg-text text-bg" : done ? "text-text hover:bg-text/[0.06]" : "text-muted")}
                  >
                    <span className="numeral text-[0.6875rem]">{i + 1}</span> {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {step === "mood" ? (
          <motion.section key="mood" aria-labelledby="pick-mood" className="mt-12" {...fade} transition={{ duration: 0.45, ease: ease.out }}>
            <h2 id="pick-mood" className="sr-only">
              Pick a mood
            </h2>
            {o ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {o.presets.map((p, i) => (
                  <li key={p.id}>
                    <MoodTile
                      id={p.id}
                      label={p.label}
                      line={p.line}
                      index={i}
                      selected={preset === p.id}
                      onPick={() => {
                        setPreset(p.id);
                        setText("");
                        window.setTimeout(() => setStep("time"), reduced ? 0 : 260);
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[4/3] w-full rounded-[6px]" />
                ))}
              </div>
            )}
            <form
              className="mt-10 flex max-w-2xl flex-wrap items-end gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                setPreset(null);
                setStep("time");
              }}
            >
              <label className="min-w-[16rem] flex-1">
                <span className="text-meta text-muted">Or describe it…</span>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 200))}
                  placeholder="Cosy but a bit strange, like a rainy Sunday"
                  className="mt-1.5 block h-12 w-full rounded-none border-0 border-b border-hairline-strong bg-transparent text-[1.0625rem] text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
                />
              </label>
              <Button type="submit" variant="secondary" disabled={!text.trim()}>
                Use this <ArrowRight size={16} weight="light" aria-hidden="true" />
              </Button>
            </form>
          </motion.section>
        ) : step === "time" ? (
          <motion.section key="time" aria-labelledby="pick-time" className="mt-12 max-w-4xl" {...fade} transition={{ duration: 0.45, ease: ease.out }}>
            <p className="text-meta text-muted">{moodName}</p>
            <h2 id="pick-time" className="mt-1 font-display text-h3">
              How long have you got?
            </h2>
            {o ? <TimeDial value={time} onChange={setTime} options={o.times} /> : null}
            <div className="mt-10 flex gap-3">
              <Button variant="ghost" onClick={() => setStep("mood")}>
                Back
              </Button>
              <Button onClick={() => setStep("company")}>
                Next <ArrowRight size={16} weight="light" aria-hidden="true" />
              </Button>
            </div>
          </motion.section>
        ) : step === "company" ? (
          <motion.section key="company" aria-labelledby="pick-company" className="mt-12 max-w-3xl" {...fade} transition={{ duration: 0.45, ease: ease.out }}>
            <p className="text-meta text-muted">
              {moodName} · {o?.times.find((t) => t.id === time)?.label}
            </p>
            <h2 id="pick-company" className="mt-1 font-display text-h3">
              Who’s watching? <span className="text-muted">(optional)</span>
            </h2>
            <div role="radiogroup" aria-labelledby="pick-company" className="mt-6 flex flex-wrap gap-2">
              {o?.companies.map((c) => {
                const on = company === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCompany(on ? null : c.id)}
                    className={cn(
                      "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[0.9375rem] transition-colors duration-200",
                      on ? "border-text bg-text text-bg" : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
                    )}
                  >
                    {on ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
                    {c.label}
                  </button>
                );
              })}
            </div>
            {company === "friends" && lists.data?.lists.length ? (
              <div className="mt-6 rounded-[var(--radius-panel)] border border-hairline bg-surface p-4">
                <p className="text-[0.9375rem]">Watching together? Reverie can pick from a shared list, by what works for all of you.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lists.data.lists.map((l) => (
                    <Link key={l.id} href={`/lists/${l.id}?pick=1`} className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline-strong px-4 text-[0.875rem] text-muted transition-colors hover:border-text/40 hover:text-text">
                      <Shuffle size={14} weight="light" aria-hidden="true" /> Pick from {l.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-8">
              <Switch
                checked={onlyMine}
                onChange={setOnlyMine}
                label="Only what’s on my services"
                description={
                  o?.servicesCount ? (
                    "Streaming in your region on the services you picked in Settings."
                  ) : (
                    <>
                      You haven’t picked your services yet.{" "}
                      <Link href="/settings#services" className="link-draw text-text">
                        Choose them in Settings
                      </Link>
                    </>
                  )
                }
              />
            </div>
            <div className="mt-10 flex gap-3">
              <Button variant="ghost" onClick={() => setStep("time")}>
                Back
              </Button>
              <Button onClick={go} size="lg">
                Show me three
              </Button>
            </div>
          </motion.section>
        ) : (
          <motion.section key="results" aria-labelledby="mood-picks" className="mt-12" {...fade} transition={{ duration: 0.45, ease: ease.out }}>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 id="mood-picks" className="font-display text-h3">
                {result ? `For “${result.label}”, ${o?.times.find((t) => t.id === time)?.label.toLowerCase() ?? ""}` : "Reading the room…"}
              </h2>
              <Button variant="ghost" onClick={restart}>
                <ArrowCounterClockwise size={16} weight="light" aria-hidden="true" /> Another mood
              </Button>
            </div>
            {result?.servicesMissing ? (
              <p className="mt-3 text-meta text-muted">
                You haven’t picked your services yet, so these are from everywhere.{" "}
                <Link href="/settings#services" className="link-draw text-text">
                  Choose them
                </Link>
              </p>
            ) : null}
            {!result ? (
              <PicksSkeleton />
            ) : result.picks.length ? (
              <Picks result={result} />
            ) : (
              <div className="mt-10 max-w-xl border-t border-hairline pt-6">
                <p className="font-display text-h4">Nothing fits all of that right now.</p>
                <p className="mt-2 text-muted">{onlyMine ? "Try without “only my services”, or give yourself a little more time." : "Try a different time, or another mood."}</p>
                <Button className="mt-6" variant="secondary" onClick={() => setStep("company")}>
                  Change the details
                </Button>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function MoodTile({ id, label, line, index, selected, onPick }: { id: string; label: string; line: string; index: number; selected: boolean; onPick: () => void }) {
  const reduced = useReducedMotion();
  const [a, b] = WASH[id] ?? ["232 162 58", "120 90 60"];
  const style = { "--wash-a": a, "--wash-b": b } as CSSProperties;
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: ease.out, delay: reduced ? 0 : index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      style={style}
      className={cn(
        "group relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden rounded-[6px] border bg-surface p-4 text-left transition-[border-color] duration-300",
        selected ? "border-text" : "border-hairline hover:border-hairline-strong",
      )}
    >
      {/* The mood's light: two washes that drift a little toward the pointer's corner on hover. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110 motion-reduce:transition-none"
        style={{
          background: "radial-gradient(120% 90% at 0% 100%, rgb(var(--wash-a) / 0.55), transparent 62%), radial-gradient(90% 80% at 100% 0%, rgb(var(--wash-b) / 0.5), transparent 70%)",
        }}
      />
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-bg/70 via-bg/10 to-transparent" />
      {selected ? (
        <span aria-hidden="true" className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-text text-bg">
          <Check size={14} weight="bold" />
        </span>
      ) : null}
      <span className="relative font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.05] text-text">{label}</span>
      <span className="relative mt-1 text-meta leading-snug text-text/75">{line}</span>
    </motion.button>
  );
}

/** Four stops on a track; the knob glides between them (arrow keys too). */
function TimeDial({ value, onChange, options }: { value: MoodTime; onChange: (t: MoodTime) => void; options: { id: MoodTime; label: string; hint: string }[] }) {
  const i = options.findIndex((o) => o.id === value);
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    onChange(options[(i + step + options.length) % options.length]!.id);
  };
  return (
    <div role="radiogroup" aria-label="How long have you got?" className="relative mt-10" onKeyDown={onKey}>
      <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-[11px] h-px bg-hairline-strong" />
      <motion.span
        aria-hidden="true"
        className="absolute left-[12.5%] top-[11px] h-px bg-accent"
        animate={{ width: `${(i / (options.length - 1)) * 75}%` }}
        transition={spring.soft}
      />
      <div className="relative grid grid-cols-4">
        {options.map((o, j) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.id)}
              className="group flex flex-col items-center gap-3 rounded-[6px] px-1 pb-2 text-center outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-accent)]"
            >
              <span className="relative grid size-6 place-items-center">
                <span className={cn("size-2.5 rounded-full transition-colors", j <= i ? "bg-accent" : "bg-hairline-strong group-hover:bg-text/40")} />
                {on ? <motion.span layoutId="time-knob" className="absolute inset-0 rounded-full border-2 border-accent bg-bg" transition={spring.snappy} /> : null}
              </span>
              <span className={cn("text-[0.9375rem] leading-tight sm:text-[1.0625rem]", on ? "text-text" : "text-muted")}>{o.label}</span>
              <span className="text-meta text-muted">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Picks({ result }: { result: MoodResult }) {
  const [picks, setPicks] = useState(result.picks);
  const [exhausted, setExhausted] = useState<string[]>([]);
  return (
    <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={true}>
        {picks.map((p, i) => (
          <PickCard
            key={p.key}
            pick={p}
            index={i}
            sessionId={result.sessionId}
            noMore={exhausted.includes(p.key)}
            onSwapped={(next) => {
              if (next) setPicks((cur) => cur.map((x) => (x.key === p.key ? next : x)));
              else setExhausted((e) => [...e, p.key]);
            }}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function PickCard({ pick, index, sessionId, noMore, onSwapped }: { pick: MoodPick; index: number; sessionId: string; noMore: boolean; onSwapped: (next: MoodPick | null) => void }) {
  const reduced = useReducedMotion();
  const swap = useSwapMood();
  const toggle = useToggleWatchlist();
  const [saved, setSaved] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const c = pick.card;
  // The cinematic reveal: one card after another, the poster settling as it arrives.
  const delay = reduced ? 0 : 0.15 + index * 0.35;

  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40, rotate: -4, scale: 0.94, transition: { duration: 0.32, ease: ease.inOut } }}
      transition={{ duration: 0.9, ease: ease.out, delay }}
      className="flex flex-col [perspective:1200px]"
    >
      <Link href={c.href} onClick={() => chooseMoodPick(sessionId, pick.key)} className="group relative block aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-surface">
        {c.posterPath ? (
          <motion.span className="absolute inset-0" initial={reduced ? false : { scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: ease.out, delay }}>
            <Image src={tmdbImg(c.posterPath)!} alt={`${c.title} poster`} fill sizes="(min-width: 768px) 30vw, 90vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
          </motion.span>
        ) : null}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-bg/80 to-transparent" />
        {pick.match != null ? <MatchMini value={pick.match} className="absolute bottom-3 right-3 rounded-full bg-bg/80" /> : null}
      </Link>
      <div className="mt-4">
        <Link href={c.href} onClick={() => chooseMoodPick(sessionId, pick.key)} className="font-display text-h4 leading-tight hover:underline">
          {c.title}
        </Link>
        <p className="mt-1 text-meta text-muted">{[c.year, pick.length].filter(Boolean).join(" · ")}</p>
        <p className="mt-3 font-display text-[1.1875rem] italic leading-snug text-text/90">{pick.reason}</p>
        <p className="mt-3 text-meta">
          {pick.streaming.length ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-muted">On</span>
              {pick.streaming.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 text-text">
                  {s.logoPath ? <Image src={tmdbImg(s.logoPath, "logo")!} alt="" width={18} height={18} className="rounded-[4px]" /> : null}
                  {s.name}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted">Not streaming in your region right now. Add it to your watchlist and we’ll keep an eye out.</span>
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {pick.trailerKey ? (
            <Button size="sm" variant="secondary" onClick={() => setTrailer(true)}>
              <Play size={14} weight="fill" aria-hidden="true" /> Trailer
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            aria-pressed={saved}
            pending={toggle.isPending}
            onClick={() =>
              toggle.mutate(
                { mediaType: c.mediaType, tmdbId: c.tmdbId, on: !saved },
                {
                  onSuccess: () => {
                    setSaved(!saved);
                    if (!saved) chooseMoodPick(sessionId, pick.key);
                  },
                  onError: (err) => toast({ title: "Couldn’t update your watchlist", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                },
              )
            }
          >
            <BookmarkSimple size={14} weight={saved ? "fill" : "light"} aria-hidden="true" /> {saved ? "On your watchlist" : "Watchlist"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={noMore}
            pending={swap.isPending}
            aria-label={`Not this: show another instead of ${c.title}`}
            onClick={() =>
              swap.mutate(
                { sessionId, key: pick.key },
                {
                  onSuccess: ({ pick: next }) => {
                    if (!next) toast({ title: "That’s every pick for this mood", description: "Try another mood, or a different time." });
                    onSwapped(next);
                  },
                  onError: (err) => toast({ title: "Couldn’t swap that", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                },
              )
            }
          >
            {noMore ? "No more like this" : "Not this"}
          </Button>
        </div>
      </div>
      {pick.trailerKey ? <TrailerModal videoId={trailer ? pick.trailerKey : null} title={`${c.title}: trailer`} open={trailer} onOpenChange={setTrailer} /> : null}
    </motion.li>
  );
}

function PicksSkeleton() {
  return (
    <div aria-busy="true" className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden="true">
          <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-surface">
            <span className="beam" />
          </div>
          <Skeleton className="mt-4 h-7 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function MoodSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-24 w-full max-w-xl" />
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-[6px]" />
        ))}
      </div>
    </div>
  );
}
