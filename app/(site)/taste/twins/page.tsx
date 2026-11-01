import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { TwinsView } from "@/components/twins/TwinsView";

export const metadata: Metadata = {
  title: "Your Taste Twins",
  description: "The people whose taste is closest to yours: anonymous until you both connect.",
  robots: { index: false },
};

export default function TwinsPage() {
  return (
    <PageTransition>
      <TwinsView />
    </PageTransition>
  );
}
