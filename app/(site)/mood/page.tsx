import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { MoodView } from "@/components/mood/MoodView";

export const metadata: Metadata = {
  title: "What’s your mood tonight?",
  description: "Tell Reverie how you feel and how long you’ve got: three picks made for right now and for your taste.",
  robots: { index: false },
};

export default function MoodPage() {
  return (
    <PageTransition>
      <MoodView />
    </PageTransition>
  );
}
