"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StepFrame } from "@/components/onboarding/StepFrame";
import { useOnboarding } from "@/lib/store/onboarding";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import type { Category } from "@/lib/catalog/types";
import type { FormatPosters } from "@/lib/taste/types";

const TILES: { id: Category; label: string; line: string }[] = [
  { id: "movie", label: "Movies", line: "Features, from everywhere" },
  { id: "series", label: "Series", line: "Shows worth a whole season" },
  { id: "anime", label: "Anime", line: "Japanese animation" },
  { id: "cartoon", label: "Cartoons", line: "Animation for every age" },
];

export function FormatsStep({ posters }: { posters: FormatPosters }) {
  const formats = useOnboarding((s) => s.formats);
  const toggle = useOnboarding((s) => s.toggle);
  const next = useOnboarding((s) => s.next);
  const back = useOnboarding((s) => s.back);

  return (
    <StepFrame
      title={
        <>
          What do you <em>watch?</em>
        </>
      }
      lede="Pick every format you’re into. The rest stays out of your way."
      footer={
        <>
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
          <Button onClick={next}>{formats.length ? "Continue" : "All of it"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {TILES.map((tile, i) => (
          <FormatTile
            key={tile.id}
            {...tile}
            index={i}
            posters={posters[tile.id]}
            selected={formats.includes(tile.id)}
            onToggle={() => toggle("formats", tile.id)}
          />
        ))}
      </div>
    </StepFrame>
  );
}

function FormatTile({
  label,
  line,
  posters,
  selected,
  onToggle,
  index,
}: {
  label: string;
  line: string;
  posters: string[];
  selected: boolean;
  onToggle: () => void;
  index: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: ease.out, delay: 0.15 + index * 0.06 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[6px] border p-4 text-left md:p-5",
        "transition-[border-color,background-color] duration-300",
        selected ? "border-accent/70 bg-raised" : "border-hairline-strong bg-surface hover:border-text/30",
      )}
    >
      {/* Warm spill behind the fan when picked. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-[radial-gradient(50%_55%_at_50%_45%,color-mix(in_oklab,var(--color-accent)_30%,transparent),transparent)] transition-opacity duration-500",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[9%] h-[50%] md:top-[10%] md:h-[58%]">
        {posters.map((path, i) => {
          const off = i - (posters.length - 1) / 2;
          return (
            <motion.span
              key={path}
              className="absolute left-1/2 top-0 aspect-[2/3] h-full overflow-hidden rounded-[2px] shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]"
              style={{ zIndex: 3 - Math.abs(off) }}
              initial={false}
              animate={{
                x: `calc(-50% + ${off * (selected ? 46 : 30)}%)`,
                y: selected ? `${Math.abs(off) * 5 - 4}%` : `${Math.abs(off) * 3}%`,
                rotate: off * (selected ? 11 : 6),
                scale: selected ? 1.04 : 0.96,
                filter: selected ? "grayscale(0) brightness(1)" : "grayscale(0.85) brightness(0.55)",
              }}
              transition={reduced ? { duration: 0 } : spring.soft}
            >
              <Image src={tmdbImg(path, "thumb")!} alt="" fill sizes="120px" className="object-cover" />
            </motion.span>
          );
        })}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "absolute right-3 top-3 grid size-7 place-items-center rounded-full border transition-colors duration-300",
          selected ? "border-accent bg-accent text-accent-ink" : "border-hairline-strong text-transparent",
        )}
      >
        <motion.span initial={false} animate={{ scale: selected ? 1 : 0.4, opacity: selected ? 1 : 0 }} transition={spring.snappy}>
          <Check size={14} weight="bold" />
        </motion.span>
      </span>

      <span className="relative z-10 font-display text-[clamp(1.5rem,2.6vw,2.125rem)] leading-none">{label}</span>
      <span className="relative z-10 mt-1.5 text-meta text-muted">{line}</span>
    </motion.button>
  );
}
