export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "reverie-theme";

/**
 * Inline, pre-paint: dark is the house default; only an explicit choice switches to matinée.
 * Also marks <html class="js"> so reveal targets can start hidden only when JS will reveal them.
 */
export const themeBootScript = `(function(){var d=document.documentElement;d.classList.add("js");try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");d.dataset.theme=t==="light"?"light":"dark"}catch(e){d.dataset.theme="dark"}})()`;

export function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
}

/**
 * Switch theme. Where supported, the new theme irises open from `origin`
 * (the toggle's centre), like a lamp coming up in the booth.
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (arg: { update: () => void; types?: string[] }) => { ready: Promise<void> };
  };

  if (!doc.startViewTransition || reduced || !origin) {
    applyTheme(theme);
    return;
  }

  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = doc.startViewTransition({ update: () => applyTheme(theme), types: ["theme"] });
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
}
