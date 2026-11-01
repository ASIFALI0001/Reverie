"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { AboutData } from "@/lib/about/data";
import type { SceneProps } from "@/components/about/types";
import { cn } from "@/lib/cn";

// One chunk per chapter: a scene's code loads only when its chapter comes near.
const SCENES = {
  opening: dynamic(() => import("@/components/about/scenes/Opening"), { ssr: false }),
  problem: dynamic(() => import("@/components/about/scenes/Problem"), { ssr: false }),
  taste: dynamic(() => import("@/components/about/scenes/Taste"), { ssr: false }),
  match: dynamic(() => import("@/components/about/scenes/Match"), { ssr: false }),
  whyNot: dynamic(() => import("@/components/about/scenes/WhyNot"), { ssr: false }),
  ask: dynamic(() => import("@/components/about/scenes/Ask"), { ssr: false }),
  mood: dynamic(() => import("@/components/about/scenes/Mood"), { ssr: false }),
  similar: dynamic(() => import("@/components/about/scenes/Similar"), { ssr: false }),
  vibe: dynamic(() => import("@/components/about/scenes/Vibe"), { ssr: false }),
  series: dynamic(() => import("@/components/about/scenes/Series"), { ssr: false }),
  library: dynamic(() => import("@/components/about/scenes/Library"), { ssr: false }),
  timeline: dynamic(() => import("@/components/about/scenes/Timeline"), { ssr: false }),
  twins: dynamic(() => import("@/components/about/scenes/Twins"), { ssr: false }),
  friends: dynamic(() => import("@/components/about/scenes/Friends"), { ssr: false }),
  watch: dynamic(() => import("@/components/about/scenes/Watch"), { ssr: false }),
  closing: dynamic(() => import("@/components/about/scenes/Closing"), { ssr: false }),
} satisfies Record<string, ComponentType<SceneProps>>;

/**
 * A chapter's visual, mounted when the chapter is within a screen of the viewport (the opening
 * mounts straight away). Until then it holds its space, so nothing below jumps when it arrives.
 */
export type SceneName = keyof typeof SCENES;

export function LazyScene({ name, data, eager = false, className }: { name: SceneName; data: AboutData | null; eager?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const Scene = SCENES[name];
  return (
    <div ref={ref} className={cn("relative", className)}>
      {near ? <Scene data={data} /> : null}
    </div>
  );
}
