"use client";

import { animate } from "motion";

function ghostImage(imageUrl: string, from: DOMRect, origin = "center") {
  const ghost = document.createElement("img");
  ghost.src = imageUrl;
  ghost.alt = "";
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    objectFit: "cover",
    borderRadius: "2px",
    zIndex: "9500",
    pointerEvents: "none",
    transformOrigin: origin,
    boxShadow: "0 20px 40px -12px rgb(0 0 0 / 0.6)",
  });
  document.body.appendChild(ghost);
  return ghost;
}

/** Fly a copy of an image from one box into another (a slot), landing at the slot's size. */
export async function flyInto(from: DOMRect, imageUrl: string, to: DOMRect) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ghost = ghostImage(imageUrl, from, "top left");
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  try {
    await animate(
      ghost,
      {
        x: [0, dx * 0.5, dx],
        y: [0, dy * 0.5 - 48, dy],
        scaleX: [1, (1 + to.width / from.width) / 2, to.width / from.width],
        scaleY: [1, (1 + to.height / from.height) / 2, to.height / from.height],
      },
      { duration: 0.6, ease: [0.16, 1, 0.3, 1], times: [0, 0.5, 1] },
    );
  } finally {
    ghost.remove();
  }
}

/**
 * Send a thumbnail flying from `from` into the nav's Library or Watchlist icon,
 * which answers with a little bounce. Reduced motion: just the bounce.
 */
export async function flyToNav(from: DOMRect | null, imageUrl: string | null, target: "library" | "watchlist") {
  const targetEl = [...document.querySelectorAll<HTMLElement>(`[data-fly-target="${target}"]`)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!targetEl) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (from && imageUrl && !reduced) {
    const to = targetEl.getBoundingClientRect();
    const ghost = ghostImage(imageUrl, from);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const end = Math.max(0.08, Math.min(to.width / from.width, 0.2));
    try {
      // An arc: lift first, then dive into the icon.
      await animate(
        ghost,
        {
          x: [0, dx * 0.35, dx],
          y: [0, dy * 0.35 - 80, dy],
          scale: [1, 0.55, end],
          rotate: [0, -6, 0],
          opacity: [1, 1, 0.2],
        },
        { duration: 0.85, ease: [0.16, 1, 0.3, 1], times: [0, 0.45, 1] },
      );
    } finally {
      ghost.remove();
    }
  }
  targetEl.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.28)" }, { transform: "scale(0.92)" }, { transform: "scale(1)" }],
    { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}
