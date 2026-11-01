"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { Magnetic } from "@/components/motion/Magnetic";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGsapScene } from "@/components/about/useGsapScene";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";

/**
 * 15 · Closing. Back to the dark: one poster, and a ring drawing itself around it as the section
 * scrolls into view (scrubbed with the scroll, not pinned). Then the way in, a big magnetic button:
 * sign up, or straight to Home if you're already in. Reduced motion: the ring, drawn.
 */
export default function Closing({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { status } = useAuth();
  const poster = titleOf(data, CAST.closing);

  useGsapScene(ref, !reduced, "once", ({ gsap }, _root, el) => {
    gsap.fromTo(el.querySelector("[data-ring]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 85%", end: "center 55%", scrub: 0.5 } });
  });

  return (
    <div ref={ref} className="flex flex-col items-center text-center">
      <div className="relative">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute -inset-[22%] size-[144%] -rotate-90">
          <circle cx="50" cy="50" r="48" fill="none" stroke="var(--color-hairline)" strokeWidth="0.4" />
          <circle data-ring cx="50" cy="50" r="48" fill="none" stroke="var(--color-accent)" strokeWidth="0.8" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={reduced ? 0 : 1} />
        </svg>
        {poster?.posterPath ? (
          <div className="relative aspect-[2/3] w-[clamp(9rem,16vw,12rem)] overflow-hidden rounded-[2px] shadow-[0_40px_90px_rgb(0_0_0/0.6)]">
            <Image src={tmdbImg(poster.posterPath)!} alt="" fill sizes="12rem" className="object-cover" />
          </div>
        ) : (
          <div className="aspect-[2/3] w-[clamp(9rem,16vw,12rem)] rounded-[2px] bg-surface" />
        )}
      </div>
      <div className="mt-[clamp(4rem,9vw,6rem)]">
        <Magnetic strength={0.4} max={14}>
          <Button asChild size="lg">
            <Link href={status === "signed-in" ? "/" : "/signup"}>
              Start with your taste <ArrowRight size={18} weight="light" aria-hidden="true" />
            </Link>
          </Button>
        </Magnetic>
      </div>
    </div>
  );
}
