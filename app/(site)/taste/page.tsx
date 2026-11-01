import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { TasteTimelineView } from "@/components/taste/TasteTimelineView";

export const metadata: Metadata = {
  title: "Your taste",
  description: "Your Taste DNA, the eras your taste has moved through, and what you watched month by month.",
  robots: { index: false },
};

export default function TastePage() {
  return (
    <PageTransition>
      <TasteTimelineView />
    </PageTransition>
  );
}
