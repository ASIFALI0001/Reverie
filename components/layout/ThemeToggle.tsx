"use client";

import { useId, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { readTheme, setTheme, type Theme } from "@/lib/theme";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark");
}

const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

/** Screening room ⇄ matinée. The same crescent as the logo fills into a sun. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const isDark = theme === "dark";
  const label = isDark ? "Switch to matinée (light) theme" : "Switch to screening room (dark) theme";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTheme(isDark ? "light" : "dark", { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      className={cn(
        "grid size-10 place-items-center rounded-full text-muted transition-colors duration-150 hover:text-text",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <defs>
          <mask id={`tt-${id}`}>
            <rect width="24" height="24" fill="white" />
            <motion.circle
              r="6"
              fill="black"
              initial={false}
              animate={isDark ? { cx: 15.6, cy: 8.6 } : { cx: 24, cy: 0 }}
              transition={spring.soft}
            />
          </mask>
        </defs>
        <motion.circle
          cx="12"
          cy="12"
          fill="currentColor"
          mask={`url(#tt-${id})`}
          initial={false}
          animate={{ r: isDark ? 6.5 : 4.4 }}
          transition={spring.soft}
        />
        {RAYS.map((a, i) => (
          <motion.line
            key={i}
            x1={12 + Math.cos(a) * 7.2}
            y1={12 + Math.sin(a) * 7.2}
            x2={12 + Math.cos(a) * 9.4}
            y2={12 + Math.sin(a) * 9.4}
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            initial={false}
            animate={{ opacity: isDark ? 0 : 1, pathLength: isDark ? 0 : 1 }}
            transition={{ ...spring.soft, delay: isDark ? 0 : i * 0.02 }}
          />
        ))}
      </svg>
    </button>
  );
}
