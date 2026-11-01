"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/**
 * Read a query parameter without useSearchParams(). Pages that use this stay
 * fully static (no dynamic hole for Partial Prerendering to resume): the server
 * and hydration see null, then the real value arrives on the client.
 */
export function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

/** Read a parameter at event time (e.g. on submit), where hooks don't apply. */
export function readQueryParam(name: string): string | null {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name);
}
