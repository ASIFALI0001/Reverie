"use client";

import { ToggleGroup } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Slider } from "@/components/ui/Slider";
import { StepFrame } from "@/components/onboarding/StepFrame";
import { useOnboarding } from "@/lib/store/onboarding";
import { LANGUAGE_OPTIONS } from "@/lib/taste/languages";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import type { Ending } from "@/lib/taste/types";

type ScaleKey = "pace" | "tone" | "complexity" | "era";

const SCALES: { key: ScaleKey; label: string; min: string; max: string }[] = [
  { key: "pace", label: "Pace", min: "Slow-burn", max: "Fast and loud" },
  { key: "tone", label: "Tone", min: "Light", max: "Dark" },
  { key: "complexity", label: "Complexity", min: "Easy watch", max: "Make me think" },
  { key: "era", label: "Era", min: "New releases", max: "Classics" },
];

const ENDINGS: { value: Ending; label: string }[] = [
  { value: "happy", label: "Happy" },
  { value: "ambiguous", label: "Ambiguous" },
  { value: "tragic", label: "Tragic" },
  { value: "any", label: "All fine" },
];

export function QuickStep() {
  const s = useOnboarding();
  const reduced = useReducedMotion();
  const rise = (i: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: ease.out, delay: 0.2 + i * 0.06 },
  });

  return (
    <StepFrame
      title={
        <>
          A few quick <em>ones</em>
        </>
      }
      lede="Leave anything you don’t feel strongly about."
      footer={
        <>
          <Button variant="ghost" onClick={s.back}>
            Back
          </Button>
          <Button onClick={s.next}>Build my taste</Button>
        </>
      }
    >
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <div className="space-y-9">
          {SCALES.map((scale, i) => {
            const value = s[scale.key];
            return (
              <motion.div key={scale.key} {...rise(i)}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-h4">{scale.label}</h2>
                  {value == null ? (
                    <span className="text-meta text-muted">No preference</span>
                  ) : (
                    <button type="button" onClick={() => s.set({ [scale.key]: null })} className="link-draw text-meta text-muted">
                      Clear
                    </button>
                  )}
                </div>
                <Slider
                  bipolar
                  label={scale.label}
                  minLabel={scale.min}
                  maxLabel={scale.max}
                  value={Math.round((value ?? 0.5) * 100)}
                  onValueChange={(v) => s.set({ [scale.key]: v / 100 })}
                  className={cn("mt-1 transition-opacity", value == null && "opacity-60")}
                />
              </motion.div>
            );
          })}
        </div>

        <div className="space-y-10">
          <motion.div {...rise(4)}>
            <h2 className="font-display text-h4" id="q-endings">
              Endings
            </h2>
            <ToggleGroup.Root
              type="single"
              aria-labelledby="q-endings"
              value={s.endings ?? ""}
              onValueChange={(v) => s.set({ endings: (v || null) as Ending | null })}
              className="mt-4 flex flex-wrap gap-2.5"
            >
              {ENDINGS.map((e) => (
                <ToggleGroup.Item
                  key={e.value}
                  value={e.value}
                  className={cn(
                    "h-11 rounded-full border px-5 text-[0.9375rem] transition-colors duration-200",
                    s.endings === e.value ? "border-text bg-text text-bg" : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
                  )}
                >
                  {e.label}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </motion.div>

          <motion.div {...rise(5)}>
            <h2 className="font-display text-h4" id="q-subs">
              Subtitles
            </h2>
            <ToggleGroup.Root
              type="single"
              aria-labelledby="q-subs"
              value={s.subtitles == null ? "" : s.subtitles ? "yes" : "no"}
              onValueChange={(v) => s.set({ subtitles: v === "" ? null : v === "yes" })}
              className="mt-4 flex flex-wrap gap-2.5"
            >
              {[
                { value: "yes", label: "Happy to read them" },
                { value: "no", label: "I’d rather not" },
              ].map((o) => (
                <ToggleGroup.Item
                  key={o.value}
                  value={o.value}
                  className={cn(
                    "h-11 rounded-full border px-5 text-[0.9375rem] transition-colors duration-200",
                    (s.subtitles === true && o.value === "yes") || (s.subtitles === false && o.value === "no")
                      ? "border-text bg-text text-bg"
                      : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
                  )}
                >
                  {o.label}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </motion.div>

          <motion.div {...rise(6)} role="group" aria-labelledby="q-langs">
            <h2 className="font-display text-h4" id="q-langs">
              Languages you watch in
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((l) => (
                <Chip key={l.code} selected={(s.languages ?? []).includes(l.code)} onToggle={() => s.toggle("languages", l.code)}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </StepFrame>
  );
}
