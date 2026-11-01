"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_VERSION } from "@/lib/legal";
import { spring } from "@/lib/motion";

function subscribe(onChange: () => void) {
  // Dismissed in another tab: hide here too.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function seen() {
  try {
    return localStorage.getItem(COOKIE_NOTICE_KEY) === COOKIE_NOTICE_VERSION;
  } catch {
    // Storage refused (some private windows): show it, and remember the dismissal for this visit only.
    return false;
  }
}

/**
 * The cookie notice. Reverie sets only essential cookies and remembers a few settings (the cookie
 * policy lists each one), so this tells rather than asks: there's no choice to make that would
 * change anything. It arrives a moment after the page (never competing with the first paint), sits
 * above the phone dock and below dialogs, and once dismissed stays away until the policy changes.
 */
export function CookieNotice() {
  const reduced = useReducedMotion();
  const stored = useSyncExternalStore(subscribe, seen, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, COOKIE_NOTICE_VERSION);
    } catch {}
  };

  return (
    <AnimatePresence>
      {ready && !stored && !dismissed ? (
        <motion.section
          aria-label="Cookies"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } }}
          transition={spring.soft}
          className="fixed inset-x-4 bottom-[calc(var(--dock-h)+env(safe-area-inset-bottom,0px)+0.75rem)] z-[60] rounded-[var(--radius-panel)] border border-hairline-strong bg-raised p-5 shadow-[0_24px_60px_rgb(0_0_0/0.35)] md:inset-x-auto md:bottom-8 md:left-[var(--page-x)] md:w-[25rem]"
        >
          <p className="caption text-muted">Cookies</p>
          <p className="mt-2 text-[0.9375rem] leading-snug text-text">
            Reverie uses a few essential cookies to keep you signed in, and your browser’s storage to remember things like your theme. No
            ads, no tracking.
          </p>
          <div className="mt-4 flex items-center gap-5">
            <Button size="sm" onClick={dismiss}>
              Got it
            </Button>
            <Link href="/cookies" className="link-draw text-meta text-muted hover:text-text">
              Cookie policy
            </Link>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
