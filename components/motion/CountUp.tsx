"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type CountUpProps = {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

/**
 * Counts from 0 when scrolled into view. The final value is server-rendered
 * (and announced via aria-label), so no-JS readers still get the number.
 */
export function CountUp({ value, decimals = 0, duration = 1.4, delay = 0, prefix = "", suffix = "", className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    el.dataset.countup = "ready";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: ease.out,
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value]);

  return (
    <span className={cn("numeral", className)}>
      <span className="sr-only">{format(value)}</span>
      <span ref={ref} data-countup="" aria-hidden="true">
        {format(value)}
      </span>
    </span>
  );
}
