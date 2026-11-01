"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { loadGsap } from "@/lib/fx/gsap";
import { cn } from "@/lib/cn";
import { gsapEase } from "@/lib/motion";

type SplitHeadingProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** "mount" plays immediately (heroes); "scroll" waits until the heading enters the viewport. */
  trigger?: "mount" | "scroll";
  delay?: number;
  id?: string;
};

/**
 * Big headings rise line by line out of a mask. SplitText keeps an aria-label with the
 * full text and re-splits on resize/font load (autoSplit). GSAP loads on demand: right
 * away for heroes, as the heading approaches the viewport otherwise.
 */
export function SplitHeading({ as: Tag = "h2", children, className, trigger = "scroll", delay = 0, id }: SplitHeadingProps) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(trigger === "mount");

  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    // Until the reader scrolls, only a heading already on screen needs GSAP, so page load
    // stays free of it; from the first scroll on, load half a screen ahead of the heading.
    let io: IntersectionObserver | null = null;
    const watch = (rootMargin: string) => {
      io?.disconnect();
      io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin });
      io.observe(el);
    };
    const ahead = () => watch("0px 0px 50% 0px");
    watch("0px");
    window.addEventListener("scroll", ahead, { once: true, passive: true });
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", ahead);
    };
  }, [near]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !near) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.split = "ready";
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: delay * 1000, fill: "backwards" });
      return;
    }

    let cancelled = false;
    let revert: (() => void) | null = null;
    void loadGsap().then(({ gsap, SplitText }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          linesClass: "split-line",
          onSplit(self) {
            el.dataset.split = "ready";
            self.masks.forEach((m) => m.classList.add("split-mask"));
            return gsap.from(self.lines, {
              yPercent: 112,
              duration: 1.15,
              ease: gsapEase.out,
              stagger: 0.085,
              delay,
              scrollTrigger: trigger === "scroll" ? { trigger: el, start: "top 88%", once: true } : undefined,
            });
          },
        });
      }, el);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [near, delay, trigger]);

  return (
    <Tag ref={ref} id={id} data-split="" className={cn(className)}>
      {children}
    </Tag>
  );
}
