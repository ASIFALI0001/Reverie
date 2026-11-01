"use client";

import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { StepFrame } from "@/components/onboarding/StepFrame";
import { useOnboarding } from "@/lib/store/onboarding";
import { GENRE_CHIPS, MOOD_CHIPS, type ChipDef } from "@/lib/taste/chips";

export function MoodsStep() {
  const genres = useOnboarding((s) => s.genres);
  const toggle = useOnboarding((s) => s.toggle);
  const next = useOnboarding((s) => s.next);
  const back = useOnboarding((s) => s.back);

  return (
    <StepFrame
      title={
        <>
          Pick what <em>pulls</em> you in
        </>
      }
      lede="Genres and moods, as many as you like. Three or more helps."
      footer={
        <>
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
          <div className="flex items-center gap-4">
            <p className="hidden text-meta text-muted sm:block" aria-live="polite">
              {genres.length ? (
                <>
                  <span className="numeral text-text">{genres.length}</span> picked
                </>
              ) : (
                "Nothing picked yet"
              )}
            </p>
            <Button onClick={next}>Continue</Button>
          </div>
        </>
      }
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ChipGroup title="Genres" chips={GENRE_CHIPS} picked={genres} onToggle={(id) => toggle("genres", id)} offset={0} />
        <ChipGroup title="Moods" chips={MOOD_CHIPS} picked={genres} onToggle={(id) => toggle("genres", id)} offset={GENRE_CHIPS.length} mood />
      </div>
    </StepFrame>
  );
}

function ChipGroup({
  title,
  chips,
  picked,
  onToggle,
  offset,
  mood = false,
}: {
  title: string;
  chips: ChipDef[];
  picked: string[];
  onToggle: (id: string) => void;
  offset: number;
  mood?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <div role="group" aria-labelledby={`chips-${title}`}>
      <h2 id={`chips-${title}`} className="caption text-muted">
        {title}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {chips.map((chip, i) => (
          <motion.div
            key={chip.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 26, delay: 0.2 + (offset + i) * 0.035 }}
          >
            <Chip selected={picked.includes(chip.id)} onToggle={() => onToggle(chip.id)} className="h-11 px-5 text-[0.9375rem]">
              {/* Moods are feelings, so they're set in the serif italic. */}
              {mood ? <span className="font-display text-[1.125rem] italic">{chip.label}</span> : chip.label}
            </Chip>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
