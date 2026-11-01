import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { RiseHeading } from "@/components/motion/RiseHeading";
import { PageTransition } from "@/components/motion/PageTransition";
import { LandingStory } from "@/components/landing/LandingStory";
import { Magnetic } from "@/components/motion/Magnetic";
import { MatchMini } from "@/components/title/MatchRing";
import { getShowcasePosters } from "@/lib/catalog/showcase";

/** The signed-out front door (signed-in visitors are rewritten to /home by proxy.ts). Static by design. */
export default async function LandingPage() {
  const posters = await getShowcasePosters(40);
  return (
    <PageTransition>
      <div>
        <section className="page flex min-h-[100svh] flex-col justify-end pb-[14vh] pt-[calc(var(--nav-h)+4rem)]">
          <RiseHeading className="max-w-[12ch] text-display">
            Know you’ll love it before you press <em>play.</em>
          </RiseHeading>
          <div className="grid-editorial mt-12 items-end gap-y-8">
            <p className="col-span-12 max-w-[36ch] font-display text-lead text-muted md:col-span-6">
              Reverie learns the films you love, and the ones you gave up on, then tells you how much you’ll like anything before you
              start it.
            </p>
            <div className="col-span-12 flex flex-wrap gap-3 md:col-span-5 md:col-start-8 md:justify-end">
              <Magnetic>
                <Button asChild size="lg">
                  <Link href="/signup">Create your account</Link>
                </Button>
              </Magnetic>
              <Button asChild size="lg" variant="secondary">
                <Link href="/signin">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <LandingStory posters={posters} />

        <section className="page border-t border-hairline py-[var(--section-y)]" aria-labelledby="what-you-get">
          <SplitHeading id="what-you-get" className="max-w-[18ch] text-h2">
            Three things it does <em>for you</em>
          </SplitHeading>
          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
            <Feature title="A number that’s yours" art={<MatchMini value={87} />}>
              Every title gets a Match % from your own ratings and swipes, with three reasons and one honest caveat.
            </Feature>
            <Feature
              title="Ask for a feeling"
              art={
                <span className="flex flex-wrap gap-2">
                  {["like: Jurassic World", "+ horror", "under 2h"].map((c) => (
                    <span key={c} className="rounded-full border border-hairline-strong bg-raised px-3 py-1 text-meta">
                      {c}
                    </span>
                  ))}
                </span>
              }
            >
              Type “like Jurassic World, but scarier” and get ten titles, ranked for you, each with a line on why it fits.
            </Feature>
            <Feature
              title="Where to watch, legally"
              art={
                <span className="block w-full max-w-[16rem] space-y-1.5 text-meta">
                  {[
                    ["Stream", "JioHotstar"],
                    ["Rent", "Apple TV · YouTube"],
                  ].map(([k, v]) => (
                    <span key={k} className="flex justify-between gap-4 border-b border-hairline pb-1.5">
                      <span className="text-muted">{k}</span>
                      <span>{v}</span>
                    </span>
                  ))}
                </span>
              }
            >
              Streaming, rental and purchase options for your country, straight from official provider data.
            </Feature>
          </div>
          <p className="mt-14">
            <Link href="/about" className="link-draw text-[1.0625rem] text-text">
              The whole story, chapter by chapter
            </Link>
          </p>
        </section>

        <section className="page pb-[var(--section-y)] pt-[calc(var(--section-y)*0.5)]">
          <div className="grid-editorial items-end gap-y-8 border-t border-hairline pt-[var(--section-y)]">
            <SplitHeading className="col-span-12 max-w-[14ch] text-h1 md:col-span-7">
              Start with what you <em>love.</em>
            </SplitHeading>
            <div className="col-span-12 flex flex-wrap gap-3 md:col-span-5 md:justify-end">
              <Magnetic>
                <Button asChild size="lg">
                  <Link href="/signup">Create your account</Link>
                </Button>
              </Magnetic>
              <Button asChild size="lg" variant="ghost">
                <Link href="/signin">I have one</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

function Feature({ title, art, children }: { title: string; art: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline-strong pt-6">
      <div className="flex min-h-14 items-center">{art}</div>
      <h3 className="mt-6 font-display text-h4">{title}</h3>
      <p className="mt-3 max-w-[38ch] text-muted">{children}</p>
    </div>
  );
}
