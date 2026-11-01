"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";

let settled: Promise<void> | null = null;

/** Resolves a couple of seconds after the window's load event: the page's own requests are done by then. */
function pageSettled() {
  settled ??= new Promise((resolve) => {
    const wait = () => window.setTimeout(resolve, 2000);
    if (document.readyState === "complete") wait();
    else window.addEventListener("load", wait, { once: true });
  });
  return settled;
}

/**
 * A Link for chrome that's on screen on every page (nav, dock, sign-in prompts). Plain Links
 * prefetch as soon as they're visible, so these would all fetch during page load and compete
 * with the page's own first requests. This one prefetches on intent (hover, focus, touch) or
 * once the page has settled, whichever is first. The intent pattern is from Next's prefetching guide.
 */
export function DeferredLink({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void pageSettled().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Link
      {...props}
      prefetch={ready ? null : false}
      onMouseEnter={(e) => {
        setReady(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setReady(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setReady(true);
        onTouchStart?.(e);
      }}
    />
  );
}
