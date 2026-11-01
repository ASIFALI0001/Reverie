import { SplitHeading } from "@/components/motion/SplitHeading";
import type { Vibe } from "@/lib/catalog/types";

function Scale({ label, value, low, high }: { label: string; value: number; low: string; high: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-meta">
        <span className="text-text">{label}</span>
      </div>
      <div className="relative mt-2.5 h-px bg-hairline-strong" role="img" aria-label={`${label}: ${Math.round(value * 100)} out of 100, from ${low} to ${high}`}>
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tint)]"
          style={{ left: `${value * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[0.75rem] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** What it's about (TMDB) beside how it feels (AI, clearly labelled, spoiler-free). */
export function StorySection({ overview, tagline, vibe }: { overview: string; tagline: string; vibe: Vibe | null }) {
  if (!overview && !vibe) return null;
  return (
    <section className="page py-[var(--section-y)]">
      <div className="grid-editorial gap-y-14">
        <div className="col-span-12 lg:col-span-7">
          <SplitHeading className="text-h2">The story</SplitHeading>
          {tagline ? <p className="mt-6 font-display text-h4 italic text-muted">{tagline}</p> : null}
          {overview ? <p className="mt-8 max-w-[34ch] font-display text-lead">{overview}</p> : null}
        </div>

        {vibe ? (
          <aside className="col-span-12 lg:col-span-4 lg:col-start-9" aria-labelledby="the-feel">
            <div className="border-t border-hairline-strong pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 id="the-feel" className="text-h4">
                  The feel
                </h3>
                <span className="caption">AI summary · no spoilers</span>
              </div>
              <p className="mt-5 text-[1.0625rem] leading-relaxed">{vibe.summary}</p>
              <div className="mt-8 space-y-6">
                <Scale label="Pace" value={vibe.pace} low="Slow-burn" high="Fast and loud" />
                <Scale label="Tone" value={vibe.tone} low="Light" high="Dark" />
                <Scale label="Complexity" value={vibe.complexity} low="Easy watch" high="Makes you think" />
              </div>
              <dl className="mt-8 space-y-3 text-meta">
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">Themes</dt>
                  <dd>{vibe.themes.join(", ")}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">Mood</dt>
                  <dd>{vibe.mood.join(", ")}</dd>
                </div>
              </dl>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
