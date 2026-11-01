"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { MaskHeading } from "@/components/onboarding/StepFrame";
import { Magnetic } from "@/components/motion/Magnetic";
import { useMe } from "@/lib/api/me";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useSubmitOnboarding } from "@/lib/api/taste";
import { useOnboarding } from "@/lib/store/onboarding";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { ease } from "@/lib/motion";
import type { FormatPosters } from "@/lib/taste/types";
import { afterOnboarding } from "@/lib/social/pending-invite";

export function IntroStep({ posters }: { posters: FormatPosters }) {
  const router = useRouter();
  const next = useOnboarding((s) => s.next);
  const { data: me } = useMe();
  const submit = useSubmitOnboarding();
  const retake = me?.onboardingDone ?? false;
  const reduced = useReducedMotion();

  async function skip() {
    if (retake) {
      router.push("/settings");
      return;
    }
    try {
      await submit.mutateAsync({ skip: true });
      router.replace(afterOnboarding());
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn’t save that", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  const fan = [posters.movie[0], posters.series[0], posters.anime[0], posters.cartoon[0], posters.movie[1]].filter(
    (p): p is string => !!p,
  );
  const wide = useMediaQuery("(min-width: 1024px)");
  // Fan spacing in rem: tighter on phones, where the fan sits above the heading.
  const step = wide ? 4.2 : 2.4;

  return (
    <section className="grid flex-1 content-center items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-20 lg:py-10">
      <div className="order-2 lg:order-1">
        <MaskHeading className="text-display max-w-[11ch]">
          {retake ? (
            <>
              Let’s re-learn your <em>taste.</em>
            </>
          ) : (
            <>
              Let’s learn your <em>taste.</em>
            </>
          )}
        </MaskHeading>
        <motion.p
          className="mt-6 max-w-[44ch] text-lead text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          Five quick rounds: a few choices, a stack of posters to swipe, three all-time favourites. About two minutes, and every
          match gets sharper for it.
        </motion.p>
        <motion.div
          className="mt-10 flex flex-wrap gap-3"
          initial={{ opacity: 0, y: reduced ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: ease.out, delay: 0.5 }}
        >
          <Magnetic>
            <Button size="lg" onClick={next}>
              Start
            </Button>
          </Magnetic>
          <Button size="lg" variant="ghost" onClick={skip} pending={submit.isPending}>
            {retake ? "Not now" : "Skip for now"}
          </Button>
        </motion.div>
      </div>

      {fan.length ? (
        <div aria-hidden="true" className="relative order-1 mx-auto h-[11.5rem] w-full max-w-[20rem] lg:order-2 lg:h-[24rem] lg:max-w-[26rem]">
          {fan.map((path, i) => {
            const mid = (fan.length - 1) / 2;
            const off = i - mid;
            return (
              <motion.div
                key={path}
                className="absolute left-1/2 top-1/2 aspect-[2/3] w-[6.25rem] overflow-hidden rounded-[2px] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] lg:w-[11rem]"
                style={{ zIndex: 10 - Math.abs(Math.round(off)) }}
                initial={reduced ? { opacity: 0, x: "-50%", y: "-50%" } : { opacity: 0, x: "-50%", y: "-30%", rotate: 0 }}
                animate={{
                  opacity: 1,
                  x: `calc(-50% + ${off * step}rem)`,
                  y: `calc(-50% + ${Math.abs(off) * step * 0.21}rem)`,
                  rotate: off * 7,
                }}
                transition={{ duration: 1.1, ease: ease.out, delay: 0.25 + i * 0.06 }}
              >
                <Image src={tmdbImg(path)!} alt="" fill sizes="(min-width: 1024px) 176px, 100px" className="object-cover" priority={i === 2} />
              </motion.div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
