"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

type SliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Text at each end, e.g. "Slow-burn" ↔ "Fast and loud". */
  minLabel: string;
  maxLabel: string;
  /** Accessible name for the thumb. */
  label: string;
  /** Bipolar scales have no "more is better" fill — just a centre tick. */
  bipolar?: boolean;
  className?: string;
};

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  label,
  bipolar = false,
  className,
}: SliderProps) {
  return (
    <div className={cn("w-full", className)}>
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={([v]) => onValueChange(v ?? min)}
        min={min}
        max={max}
        step={step}
        className="relative flex h-10 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-px grow bg-hairline-strong">
          {bipolar ? (
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-hairline-strong" />
          ) : (
            <SliderPrimitive.Range className="absolute h-px bg-[var(--tint)]" />
          )}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          aria-valuetext={`${label}: ${describe(value, min, max, minLabel, maxLabel)}`}
          className={cn(
            "block size-5 cursor-grab rounded-full border border-text bg-bg",
            "transition-[transform,background-color] duration-150 ease-out hover:scale-110 active:cursor-grabbing active:scale-125 active:bg-text",
          )}
        />
      </SliderPrimitive.Root>
      <div className="mt-1 flex justify-between gap-4 text-meta text-muted">
        <span>{minLabel}</span>
        <span className="text-right">{maxLabel}</span>
      </div>
    </div>
  );
}

function describe(value: number, min: number, max: number, minLabel: string, maxLabel: string) {
  const t = (value - min) / (max - min || 1);
  if (t < 0.2) return minLabel;
  if (t > 0.8) return maxLabel;
  if (t > 0.4 && t < 0.6) return "in between";
  return t < 0.5 ? `leaning ${minLabel.toLowerCase()}` : `leaning ${maxLabel.toLowerCase()}`;
}
