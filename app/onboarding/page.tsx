import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { getFormatPosters } from "@/lib/catalog/format-posters";

export const metadata: Metadata = { title: "Learn your taste", robots: { index: false } };

/** The six-step taste game: formats → moods → swipe deck → favourites → quick ones → Taste DNA. */
export default async function OnboardingPage() {
  const posters = await getFormatPosters();
  return <OnboardingFlow posters={posters} />;
}
