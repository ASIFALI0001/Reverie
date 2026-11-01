import type { Metadata } from "next";
import { WrappedStory } from "@/components/taste/WrappedStory";

export const metadata: Metadata = {
  title: "Wrapped",
  description: "Your viewing over any stretch of time, as a story: what you watched, when, how it felt and the eras you went through.",
  robots: { index: false },
};

export default function WrappedPage() {
  return <WrappedStory />;
}
