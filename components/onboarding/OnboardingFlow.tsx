"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Logo } from "@/components/brand/Logo";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMe } from "@/lib/api/me";
import { useOnboarding, type Step } from "@/lib/store/onboarding";
import { REGION_LANGUAGES } from "@/lib/taste/languages";
import { ease, spring } from "@/lib/motion";
import type { FormatPosters } from "@/lib/taste/types";
import { IntroStep } from "./IntroStep";
import { FormatsStep } from "./FormatsStep";
import { MoodsStep } from "./MoodsStep";
import { SwipeStep } from "./SwipeStep";
import { FavouritesStep } from "./FavouritesStep";
import { QuickStep } from "./QuickStep";
import { BuildingStep } from "./BuildingStep";

/** The five steps that count toward progress (intro and the build moment sit outside it). */
const COUNTED: Step[] = ["formats", "moods", "swipe", "favourites", "quick"];

export function OnboardingFlow({ posters }: { posters: FormatPosters }) {
  return (
    <AuthGuard fallback={<FlowSkeleton />}>
      <Flow posters={posters} />
    </AuthGuard>
  );
}

function Flow({ posters }: { posters: FormatPosters }) {
  const step = useOnboarding((s) => s.step);
  const dir = useOnboarding((s) => s.dir);
  const languages = useOnboarding((s) => s.languages);
  const set = useOnboarding((s) => s.set);
  const next = useOnboarding((s) => s.next);
  const { data: me } = useMe();
  const reduced = useReducedMotion();

  // Seed languages from the profile: what they already chose, plus their region's main language.
  useEffect(() => {
    if (languages !== null || !me) return;
    const regional = REGION_LANGUAGES[me.region]?.slice(0, 1) ?? [];
    set({ languages: [...new Set(["en", ...me.languages, ...regional])] });
  }, [languages, me, set]);

  const index = COUNTED.indexOf(step);
  const progress = step === "building" ? 1 : index < 0 ? 0 : index / COUNTED.length;
  const counted = index >= 0;

  return (
    <div className="relative flex min-h-[100svh] flex-col">
      <motion.div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-accent"
        initial={false}
        animate={{ scaleX: progress }}
        transition={reduced ? { duration: 0 } : spring.soft}
      />
      <header className="page flex h-[var(--nav-h)] shrink-0 items-center justify-between gap-4 pt-[env(safe-area-inset-top,0px)]">
        <Link href="/" aria-label="Reverie, home" className="rounded-full">
          <Logo />
        </Link>
        {counted ? (
          <div className="flex items-center gap-6">
            <p className="text-meta text-muted" aria-live="polite">
              Step <span className="numeral text-text">{index + 1}</span> of <span className="numeral">{COUNTED.length}</span>
            </p>
            <button type="button" onClick={next} className="link-draw text-meta text-muted hover:text-text">
              Skip this step
            </button>
          </div>
        ) : null}
      </header>

      <main id="main" className="page flex flex-1 flex-col">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            className="flex flex-1 flex-col"
            variants={{
              enter: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * 48 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * -48 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.42, ease: ease.out }}
          >
            {renderStep(step, posters)}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function renderStep(step: Step, posters: FormatPosters) {
  switch (step) {
    case "intro":
      return <IntroStep posters={posters} />;
    case "formats":
      return <FormatsStep posters={posters} />;
    case "moods":
      return <MoodsStep />;
    case "swipe":
      return <SwipeStep />;
    case "favourites":
      return <FavouritesStep />;
    case "quick":
      return <QuickStep />;
    case "building":
      return <BuildingStep />;
  }
}

function FlowSkeleton() {
  return (
    <div className="flex min-h-[100svh] flex-col" aria-busy="true">
      <header className="page flex h-[var(--nav-h)] items-center">
        <Logo />
      </header>
      <div className="page my-auto max-w-2xl">
        <Skeleton className="h-[clamp(3rem,8vw,6rem)] w-3/4" />
        <Skeleton className="mt-6 h-5 w-2/3" />
        <Skeleton className="mt-10 h-12 w-40 rounded-full" />
      </div>
    </div>
  );
}
