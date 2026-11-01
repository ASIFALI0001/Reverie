"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type RailProps = {
  /** Accessible name for the list. */
  label: string;
  heading?: ReactNode;
  children: ReactNode;
  className?: string;
  listClassName?: string;
};

const FRICTION = 0.94;

/**
 * Horizontal shelf: native scroll for touch and trackpads, drag-with-inertia for
 * mice, edge fades that only appear where there's more to see, and a hairline
 * progress indicator.
 */
export function Rail({ label, heading, children, className, listClassName }: RailProps) {
  const scroller = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false, scrollable: false });
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0, lastX: 0, lastT: 0, v: 0, raf: 0 });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft >= max - 2;
    setEdges((e) => (e.start === start && e.end === end && e.scrollable === max > 2 ? e : { start, end, scrollable: max > 2 }));
    if (bar.current) {
      const visible = el.clientWidth / el.scrollWidth;
      const progress = max > 0 ? el.scrollLeft / max : 0;
      bar.current.style.transform = `translateX(${progress * (1 / visible - 1) * 100}%) scaleX(1)`;
      bar.current.style.width = `${Math.max(8, visible * 100)}%`;
    }
  }, []);

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  // Mouse drag with momentum (touch and trackpads already scroll natively).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !scroller.current) return;
    const d = drag.current;
    cancelAnimationFrame(d.raf);
    Object.assign(d, { active: true, moved: false, startX: e.clientX, startLeft: scroller.current.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    el.scrollLeft = d.startLeft - dx;
  };
  const onPointerUp = () => {
    const d = drag.current;
    const el = scroller.current;
    if (!d.active || !el) return;
    d.active = false;
    if (!d.moved) return;
    let v = -d.v * 16; // px per frame
    const glide = () => {
      if (Math.abs(v) < 0.3) return;
      el.scrollLeft += v;
      v *= FRICTION;
      d.raf = requestAnimationFrame(glide);
    };
    d.raf = requestAnimationFrame(glide);
  };
  // A drag shouldn't also count as a click on the poster under the cursor.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div className={cn("relative", className)}>
      {heading || edges.scrollable ? (
        <div className="page mb-8 flex items-end justify-between gap-6">
          <div className="min-w-0">{heading}</div>
          {edges.scrollable ? (
            <div className="hidden shrink-0 gap-2 md:flex">
              <IconButton aria-label={`Scroll ${label} back`} onClick={() => page(-1)} disabled={edges.start} className="size-10">
                <CaretLeft size={16} weight="light" />
              </IconButton>
              <IconButton aria-label={`Scroll ${label} forward`} onClick={() => page(1)} disabled={edges.end} className="size-10">
                <CaretRight size={16} weight="light" />
              </IconButton>
            </div>
          ) : null}
        </div>
      ) : null}

      <ul
        ref={scroller}
        aria-label={label}
        data-cursor="drag"
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        style={{
          maskImage: `linear-gradient(to right, ${edges.start ? "black" : "transparent"}, black 5%, black 95%, ${edges.end ? "black" : "transparent"})`,
        }}
        className={cn(
          "flex gap-[var(--gutter)] overflow-x-auto overscroll-x-contain px-[var(--page-x)] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "cursor-grab select-none active:cursor-grabbing [scroll-padding-inline:var(--page-x)]",
          listClassName,
        )}
      >
        {children}
      </ul>

      {edges.scrollable ? (
        <div aria-hidden="true" className="page mt-6">
          <div className="relative h-px overflow-hidden bg-hairline">
            <span ref={bar} className="absolute inset-y-0 left-0 bg-text/50 transition-transform duration-150 ease-out" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
