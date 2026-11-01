"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SpeakerSimpleSlash } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MUSIC_PAGES, MUSIC_PREF_KEY, MUSIC_SRC } from "@/lib/music";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

const VOLUME = 0.35;
const PAGES = new Set<string>(MUSIC_PAGES);
// Events that count as the visitor interacting (browsers only allow sound after one). Touch grants it
// on release, a mouse on press, so all are heard and the first one the browser accepts wins.
const ACTIVATION_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;

type Pref = "on" | "off";

const noopSubscribe = () => () => {};

function subscribe(onChange: () => void) {
  // Muted in another tab: follow it here.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readPref(): Pref {
  try {
    return localStorage.getItem(MUSIC_PREF_KEY) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

function writePref(pref: Pref) {
  try {
    localStorage.setItem(MUSIC_PREF_KEY, pref);
  } catch {}
}

/**
 * Background music for visitors on the landing page and the About story, with a sound toggle in the
 * corner. Browsers allow sound only once someone has interacted with the page, so it starts at the
 * visitor's first click, tap or key (or straight away if they arrived by clicking). Nothing is
 * downloaded before then. It keeps playing between the two pages, fades out anywhere else and when
 * the tab is hidden, and a mute is remembered for later visits. Signed-in users never hear it.
 */
export function SiteMusic() {
  const pathname = usePathname();
  const { status } = useAuth();
  const reduced = useReducedMotion();
  // False on the server and while this part of the page hydrates, true after. The server can't know
  // who's signed in, and this boundary hydrates after the sign-in status has settled on the client,
  // so the toggle waits for hydration to finish; otherwise its HTML wouldn't match the server's.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const here = hydrated && status === "signed-out" && PAGES.has(pathname);
  const stored = useSyncExternalStore(subscribe, readPref, () => "on" as const);
  // This tab's own choice (a storage event never reaches the tab that wrote it).
  const [choice, setChoice] = useState<Pref | null>(null);
  const pref = choice ?? stored;
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const fading = useRef(0);
  const wanted = useRef(false);
  useEffect(() => {
    wanted.current = here && pref === "on";
  }, [here, pref]);

  const fade = useCallback((to: number, ms: number, done?: () => void) => {
    const a = audio.current;
    if (!a) return;
    cancelAnimationFrame(fading.current);
    const from = a.volume;
    const t0 = performance.now();
    const step = (now: number) => {
      // A frame's timestamp can fall a hair before t0, and volume must stay within 0–1 or it throws.
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      // iOS ignores volume, so there the music simply starts and stops.
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) fading.current = requestAnimationFrame(step);
      else done?.();
    };
    fading.current = requestAnimationFrame(step);
  }, []);

  /** Start (or resume) with a fade in. False when the browser still wants an interaction first. */
  const start = useCallback(async () => {
    const a = audio.current;
    if (!a) return false;
    if (!a.getAttribute("src")) a.src = MUSIC_SRC;
    cancelAnimationFrame(fading.current);
    if (a.paused) a.volume = 0;
    try {
      await a.play();
    } catch {
      return false;
    }
    fade(VOLUME, 1200);
    return true;
  }, [fade]);

  const stop = useCallback(
    (ms: number) => {
      const a = audio.current;
      if (!a || a.paused) return;
      fade(0, ms, () => a.pause());
    },
    [fade],
  );

  // On the right pages and not muted: play now if the visitor has already interacted, else at the first interaction.
  useEffect(() => {
    if (!here || pref === "off") return;
    if (navigator.userActivation?.hasBeenActive) {
      void start();
      return;
    }
    let done = false;
    const go = (e: Event) => {
      // The toggle answers its own clicks.
      if (done || (e.target instanceof Element && e.target.closest("[data-music-toggle]"))) return;
      void start().then((ok) => {
        if (ok) {
          done = true;
          disarm();
        }
      });
    };
    const disarm = () => ACTIVATION_EVENTS.forEach((t) => window.removeEventListener(t, go, true));
    ACTIVATION_EVENTS.forEach((t) => window.addEventListener(t, go, true));
    return disarm;
  }, [here, pref, start]);

  // Anywhere else: fade out (it picks up where it left off on the way back).
  useEffect(() => {
    if (!here) stop(600);
  }, [here, stop]);

  // A hidden tab goes quiet, and comes back if it was playing.
  useEffect(() => {
    let resume = false;
    const onVisibility = () => {
      const a = audio.current;
      if (!a) return;
      if (document.hidden) {
        resume = !a.paused;
        if (resume) a.pause();
      } else if (resume) {
        resume = false;
        if (wanted.current) void a.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => cancelAnimationFrame(fading.current), []);

  const toggle = () => {
    if (playing) {
      setChoice("off");
      writePref("off");
      stop(400);
    } else {
      setChoice("on");
      writePref("on");
      void start();
    }
  };

  const muted = pref === "off" && !playing;
  return (
    <>
      <AnimatePresence>
        {here ? (
          <motion.button
            key="music"
            type="button"
            data-music-toggle
            data-state={playing ? "playing" : muted ? "off" : "waiting"}
            // A toggle keeps one name ("Sound") and says on or off with its pressed state (and its icon).
            aria-pressed={playing}
            title={playing ? "Mute the music" : "Play the music"}
            onClick={toggle}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10, transition: { duration: 0.18 } }}
            transition={spring.soft}
            className={cn(
              "fixed bottom-[calc(var(--dock-h)+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-[55] flex h-11 min-w-11 items-center justify-center gap-2.5 rounded-full border border-hairline-strong bg-surface/90 px-3.5 shadow-[0_12px_30px_rgb(0_0_0/0.3)] transition-colors md:bottom-8 md:right-[var(--page-x)]",
              playing ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {muted ? (
              <SpeakerSimpleSlash size={16} weight="light" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className={cn("flex h-3.5 items-end gap-[2px]", playing && "music-on text-accent")}>
                {[0.9, 0.7, 1.1, 0.8].map((s, i) => (
                  <span key={i} className="music-bar block h-full w-[2px] rounded-full bg-current" style={{ animationDuration: `${s}s`, animationDelay: `${-i * 0.2}s` }} />
                ))}
              </span>
            )}
            <span className="sr-only font-mono text-[0.625rem] uppercase tracking-[0.16em] md:not-sr-only">Sound</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
      {/* No src until the music is wanted, so nothing downloads with the page. */}
      <audio ref={audio} data-site-music loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    </>
  );
}
