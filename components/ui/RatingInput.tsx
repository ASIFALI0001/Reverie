"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

const STAR = "M12 2.6l2.83 6.07 6.62.72-4.93 4.5 1.38 6.53L12 17.1l-5.9 3.32 1.38-6.53-4.93-4.5 6.62-.72z";

type RatingInputProps = {
  /** 1–10 (each half star is a point), or null for unrated. */
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  size?: number;
  className?: string;
};

/** Five stars with half-star precision (= 1–10). Pointer, touch and keyboard (arrows, Home/End, Delete). */
export function RatingInput({ value, onChange, label = "Your rating", size = 34, className }: RatingInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const clipBase = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shown = hover ?? value ?? 0;

  const valueAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width - 0.01);
    return Math.max(1, Math.ceil((x / r.width) * 10));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = value ?? 0;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(10, v + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, v - 1)
      : e.key === "Home" ? 1
      : e.key === "End" ? 10
      : e.key === "Delete" || e.key === "Backspace" ? null
      : undefined;
    if (next === undefined) return;
    e.preventDefault();
    onChange(next);
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value ? `${value / 2} out of 5 stars` : "Not rated"}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => e.pointerType === "mouse" && setHover(valueAt(e))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => onChange(valueAt(e))}
        className="flex cursor-pointer touch-none select-none gap-1 rounded-[4px] focus-visible:outline-offset-4"
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.min(1, Math.max(0, (shown - i * 2) / 2)); // 0, 0.5 or 1
          const clipId = `${clipBase}-${i}`;
          return (
            <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={24 * fill} height="24" />
                </clipPath>
              </defs>
              <path d={STAR} fill="none" stroke="var(--color-hairline-strong)" strokeWidth="1.1" strokeLinejoin="round" />
              <path
                d={STAR}
                fill={hover != null ? "color-mix(in oklab, var(--tint) 70%, transparent)" : "var(--tint)"}
                clipPath={`url(#${clipId})`}
                className="transition-[fill] duration-150"
              />
            </svg>
          );
        })}
      </div>
      <span className="numeral w-14 text-[1.125rem] font-light text-text">{shown ? `${shown}/10` : "—"}</span>
    </div>
  );
}
