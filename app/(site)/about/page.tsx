import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { AboutStory } from "@/components/about/AboutStory";
import { getAboutData } from "@/lib/about/data";

const description =
  "How Reverie learns your taste and tells you how much you’ll like anything before you press play: the match, honest reasons why not, mood search, series check-ins, your taste over time, twins and friends.";

export const metadata: Metadata = {
  title: "About Reverie",
  description,
  alternates: { canonical: "/about" },
  openGraph: { title: "About Reverie", description, images: [{ url: "/api/og/about", width: 1200, height: 630, alt: "About Reverie" }] },
  twitter: { card: "summary_large_image", title: "About Reverie", description, images: ["/api/og/about"] },
};

export default async function AboutPage() {
  const data = await getAboutData();
  return (
    <PageTransition>
      <AboutStory data={data} />
    </PageTransition>
  );
}
