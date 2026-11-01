"use client";

import { useSyncExternalStore } from "react";

/** Live media-query match. The server (and hydration) assumes `serverValue`. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
