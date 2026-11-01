"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { SplitFlap } from "@/components/about/SplitFlap";
import { cn } from "@/lib/cn";

export type ChapterMeta = { n: string; label: string };

const TAKEOVERS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * The story's chrome: on wide screens a rail down the left (a line that fills as you read, with
 * every chapter's number and name; click one to go there) and a split-flap counter; on phones,
 * a thin bar across the top. Links are plain anchors, so they work without JavaScript too.
 */
export function AboutChrome({ chapters }: { chapters: ChapterMeta[] }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  const release = useRef<() => void>(() => {});
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  /**
   * Go to a chapter and keep it there while the story settles. Scenes mount as they come near and
   * change the height of every chapter above the one asked for, so a glide aimed once lands short
   * (and scroll anchoring can't always make up for it). The aim is renewed whenever the story
   * changes size, until nothing has moved for a moment or the reader scrolls for themselves.
   */
  const goTo = useCallback(
    (id: string, instant = false) => {
      const el = document.getElementById(id);
      const story = el?.parentElement;
      if (!el || !story) return;
      release.current();
      // Lenis glides (or jumps, with reduced motion); without it, jump.
      let gliding = !instant && Boolean(lenisRef.current);
      let quiet = 0;
      // The hold ends after a quiet moment once there, never mid-glide.
      const settle = () => {
        window.clearTimeout(quiet);
        quiet = window.setTimeout(() => (gliding ? settle() : stop()), 1200);
      };
      const landed = () => {
        gliding = false;
        settle();
      };
      const aim = () => {
        // From the page's real offset: Lenis's own figure can trail a scroll-anchoring adjustment.
        // One pixel in (as the sections' scroll margin does for plain anchor jumps), so the chapter
        // above is fully out of view and the browser anchors scrolling to this one, not to it.
        const top = el.getBoundingClientRect().top + window.scrollY + 1;
        const l = lenisRef.current;
        if (l) {
          // Lenis caps every target at the page height it last measured (refreshed on a debounce), and the page is growing.
          l.resize();
          l.scrollTo(top, { immediate: !gliding, force: true, onComplete: landed });
        } else window.scrollTo({ top, behavior: "instant" });
      };
      const ro = new ResizeObserver(() => {
        aim();
        settle();
      });
      const cap = window.setTimeout(stop, 8000);
      function stop() {
        ro.disconnect();
        window.clearTimeout(quiet);
        window.clearTimeout(cap);
        TAKEOVERS.forEach((t) => window.removeEventListener(t, stop));
        release.current = () => {};
      }
      TAKEOVERS.forEach((t) => window.addEventListener(t, stop, { passive: true }));
      release.current = stop;
      aim();
      ro.observe(story);
    },
    [],
  );

  // Arriving with a chapter in the address: the browser has jumped there; hold it while the scenes around it mount.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (/^ch-\d\d$/.test(id)) goTo(id, true);
    const r = release;
    return () => r.current();
  }, [goTo]);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-chapter]")];
    // The chapter crossing a line 40% down the screen is the one being read.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(sections.indexOf(e.target as HTMLElement));
      },
      { rootMargin: "-40% 0px -59% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const current = chapters[active] ?? chapters[0]!;
  return (
    <>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[55] h-[2px] origin-left bg-accent lg:hidden" style={{ transform: `scaleX(${progress})` }} />
      <nav aria-label="Chapters" className="fixed left-[max(1rem,calc(var(--page-x)-0.5rem))] top-1/2 z-40 hidden -translate-y-1/2 lg:block">
        <div className="relative pl-4">
          <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-px bg-hairline-strong" />
          <span aria-hidden="true" className="absolute left-0 top-1 w-px origin-top bg-accent" style={{ height: "calc(100% - 0.5rem)", transform: `scaleY(${progress})` }} />
          <ol className="space-y-1.5">
            {chapters.map((c, i) => (
              <li key={c.n}>
                <a
                  href={`#ch-${c.n}`}
                  onClick={(e) => {
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    // Lenis would glide too, aimed once at where the chapter is right now.
                    e.stopPropagation();
                    window.history.replaceState(null, "", `#ch-${c.n}`);
                    goTo(`ch-${c.n}`);
                  }}
                  aria-current={i === active ? "location" : undefined}
                  className={cn(
                    "block font-mono text-[0.625rem] uppercase leading-5 tracking-[0.14em] transition-colors duration-300",
                    i === active ? "text-text" : "text-muted hover:text-text",
                  )}
                >
                  {c.n} {c.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>
      <div aria-hidden="true" className="fixed right-[var(--page-x)] top-[calc(var(--nav-h)+1rem)] z-40 hidden items-center gap-3 lg:flex">
        <SplitFlap value={current.n} className="text-[0.9375rem]" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">/ {chapters.at(-1)!.n}</span>
      </div>
    </>
  );
}
