import { Nav } from "@/components/layout/Nav";
import { Dock } from "@/components/layout/Dock";
import { Footer } from "@/components/layout/Footer";
import { Suspense } from "react";
import { CommandPalette } from "@/components/search/CommandPalette";
import { SocialLayer } from "@/components/social/SocialLayer";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-text focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <Nav />
      {/* The footer stays outside <main> so it is its own contentinfo landmark. Decorative spill
          (a poster's hover glow in the last grid column) is clipped at the screen edge instead of
          making the page scroll sideways on phones; clip, unlike hidden, adds no scroll container. */}
      <div className="pb-dock md:pb-0">
        <main id="main" className="overflow-x-clip">
          {children}
        </main>
        <Footer />
      </div>
      <Dock />
      <CommandPalette />
      {/* Reads the URL (to stay quiet during onboarding), so it gets its own boundary. */}
      <Suspense fallback={null}>
        <SocialLayer />
      </Suspense>
    </>
  );
}
