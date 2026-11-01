"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { SeasonChart } from "@/components/series/SeasonChart";
import { useSeriesDecision, useSeriesProgress, useShouldContinue, type Position, type SeriesVerdictView } from "@/lib/api/series";
import { toast } from "@/lib/store/toast";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";

const BOTHERS = ["Too slow", "Lost track of the story", "The characters aren’t working", "Not funny any more", "Too dark for me", "It’s just too long"];

const select =
  "mt-1.5 block h-11 w-full cursor-pointer rounded-none border-0 border-b border-hairline-strong bg-transparent text-[1.0625rem] text-text outline-none focus-visible:border-[var(--tint)]";

function verdictLine(v: SeriesVerdictView) {
  if (v.verdict === "keep") return "Keep going";
  if (v.verdict === "stop") return "Probably stop here";
  return v.tryUntil ? `Give it till S${v.tryUntil.season}E${v.tryUntil.episode}` : "Give it a little longer";
}
const confidenceWord = (c: number) => (c >= 0.7 ? "High" : c >= 0.45 ? "Medium" : "Low");

/**
 * "Should I keep going?" for a series: where you are (prefilled from your library), what's
 * bothering you if anything, then a spoiler-free verdict with reasons, the ratings ahead, and
 * what you decide (which files it as Watching or Dropped).
 */
export function ShouldContinueSheet({ tvId, title, open, onOpenChange }: { tvId: number; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const progress = useSeriesProgress(tvId, open);
  const ask = useShouldContinue(tvId);
  const decide = useSeriesDecision(tvId);
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<Position | null>(null);
  const [bother, setBother] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<SeriesVerdictView | null>(null);

  const seasons = progress.data?.seasons ?? [];
  const position: Position | null = picked ?? progress.data?.progress ?? (seasons.length ? { season: seasons[0]!.season, episode: 1 } : null);
  const episodesIn = seasons.find((s) => s.season === position?.season)?.episodes ?? 0;

  // Start fresh next time, once the sheet has slid away.
  function close() {
    onOpenChange(false);
    window.setTimeout(() => {
      setAnswer(null);
      setPicked(null);
      setBother(null);
      setText("");
    }, 300);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title="Should I keep going?"
      description={`${title}: spoiler-free. Only pace, tone and how the ratings move, never what happens.`}
    >
      {answer ? (
        <div className="mt-6">
          <motion.p
            className="font-display text-h2 leading-none"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.25, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={reduced ? { duration: 0.3 } : { type: "spring", stiffness: 420, damping: 18 }}
          >
            {verdictLine(answer)}
          </motion.p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta">
            <span className="inline-flex items-center gap-2 text-muted">
              Confidence
              <span aria-hidden="true" className="flex gap-0.5">
                {[0.3, 0.55, 0.75].map((t) => (
                  <span key={t} className={cn("h-1.5 w-4 rounded-full", answer.confidence >= t ? "bg-accent" : "bg-text/15")} />
                ))}
              </span>
              <span className="text-text">{confidenceWord(answer.confidence)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong px-2.5 py-1 text-text">
              <ShieldCheck size={14} weight="fill" className="text-accent" aria-hidden="true" /> Spoiler shield
            </span>
          </div>
          <ul className="mt-6 border-t border-hairline">
            {answer.reasons.map((r, i) => (
              <motion.li
                key={r}
                className="border-b border-hairline py-3 text-[1.0625rem] leading-snug"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: ease.out, delay: 0.25 + i * 0.1 }}
              >
                {r}
              </motion.li>
            ))}
          </ul>
          <div className="mt-6">
            <p className="text-meta text-muted">
              Episode ratings{answer.trend.watchedAvg != null ? `: ${answer.trend.watchedAvg} so far` : ""}
              {answer.trend.nextAvg != null ? `, ${answer.trend.nextAvg} for the next stretch` : ""}
            </p>
            <div className="mt-3">
              <SeasonChart chart={answer.chart} position={answer.position} />
            </div>
          </div>
          <p className="mt-4 text-meta text-muted">
            The Spoiler shield means no plot details: these reasons were checked for anything that happens after season {answer.position.season}, episode {answer.position.episode}.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(["kept", "stopped"] as const).map((d) => (
              <Button
                key={d}
                variant={d === "kept" ? "primary" : "secondary"}
                pending={decide.isPending && decide.variables?.decision === d}
                onClick={() =>
                  decide.mutate(
                    { decision: d, season: answer.position.season, episode: answer.position.episode, verdict: answer.verdict },
                    {
                      onSuccess: () => {
                        toast({ title: d === "kept" ? "Watching it is" : "Stopped here", description: d === "kept" ? "It’s in your library as Watching." : "It’s in your library as Dropped." });
                        close();
                      },
                      onError: (err) => toast({ title: "Couldn’t save that", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                    },
                  )
                }
              >
                {d === "kept" ? "I’ll keep going" : "I’m stopping here"}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setAnswer(null)}>
              A different episode
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="mt-6 space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (!position) return;
            const reason = [bother, text.trim()].filter(Boolean).join(". ") || null;
            ask.mutate(
              { season: position.season, episode: position.episode, reason },
              { onSuccess: setAnswer, onError: (err) => toast({ title: "Couldn’t answer that right now", description: err instanceof Error ? err.message : undefined, tone: "error" }) },
            );
          }}
        >
          {progress.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : progress.isError || !seasons.length ? (
            <p className="text-muted">We couldn’t load this series’ episodes. Try again in a moment.</p>
          ) : (
            <fieldset>
              <legend className="text-meta text-muted">Where are you?{progress.data?.progress ? " (from your library)" : ""}</legend>
              <div className="mt-2 grid grid-cols-2 gap-6">
                <label className="block">
                  <span className="text-meta text-muted">Season</span>
                  <select
                    value={position?.season}
                    onChange={(e) => {
                      const season = Number(e.target.value);
                      setPicked({ season, episode: Math.min(position?.episode ?? 1, seasons.find((s) => s.season === season)?.episodes ?? 1) });
                    }}
                    className={select}
                  >
                    {seasons.map((s) => (
                      <option key={s.season} value={s.season} className="bg-surface">
                        Season {s.season}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-meta text-muted">Episode you’ve just watched</span>
                  <select value={position?.episode} onChange={(e) => setPicked({ season: position!.season, episode: Number(e.target.value) })} className={select}>
                    {Array.from({ length: episodesIn }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} className="bg-surface">
                        Episode {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="text-meta text-muted">What’s bothering you? (optional)</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {BOTHERS.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={bother === b}
                  onClick={() => setBother(bother === b ? null : b)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-4 text-[0.875rem] transition-colors duration-200",
                    bother === b ? "border-text bg-text text-bg" : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="sr-only">In your own words</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 160))}
                placeholder="Or in your own words"
                className="block h-11 w-full rounded-none border-0 border-b border-hairline-strong bg-transparent text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
              />
            </label>
          </fieldset>
          <div className="flex items-center justify-between gap-4">
            <p className="inline-flex items-center gap-1.5 text-meta text-muted">
              <ShieldCheck size={14} weight="fill" className="text-accent" aria-hidden="true" /> Spoiler shield on
            </p>
            <Button type="submit" disabled={!position} pending={ask.isPending}>
              Ask Reverie
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
