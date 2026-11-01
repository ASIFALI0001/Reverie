import { ViewTransition, type ReactNode } from "react";

const TYPES = { nav: "page-enter", "nav-forward": "page-enter", "nav-back": "page-enter", default: "none" } as const;
const EXIT = { nav: "page-exit", "nav-forward": "page-exit", "nav-back": "page-exit", default: "none" } as const;

/**
 * Page-level view transition: on a typed navigation (nav links, poster clicks) the old
 * page lifts away and the new one rises behind a soft wipe; untyped ones (back button,
 * refresh, Suspense reveals) swap instantly. Wrap each page, not the layout: layouts
 * persist across navigations, so enter and exit never fire there.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={TYPES} exit={EXIT} default="none">
      {children}
    </ViewTransition>
  );
}
