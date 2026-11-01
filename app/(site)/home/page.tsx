import type { Metadata } from "next";
import { HomeGreeting } from "./HomeGreeting";
import { PageTransition } from "@/components/motion/PageTransition";
import { HomeFeed } from "@/components/home/HomeFeed";

export const metadata: Metadata = { title: "Home" };

/** The signed-in home ("/" is rewritten here by proxy.ts): Tonight, then rows picked for you. */
export default function HomePage() {
  return (
    <PageTransition>
      <div className="pb-24 pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+4rem)]">
        <section className="page">
          <HomeGreeting />
        </section>
        <HomeFeed />
      </div>
    </PageTransition>
  );
}
