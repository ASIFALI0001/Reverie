"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SearchTrigger } from "@/components/layout/SearchTrigger";
import { PRIMARY_LINKS, isActive } from "@/components/layout/nav-links";
import { useAuth } from "@/components/auth/AuthProvider";
import { DeferredLink } from "@/components/ui/DeferredLink";
import { cn } from "@/lib/cn";

// Signed-in only, so its menu primitives load on demand; the placeholder keeps the same footprint.
const UserMenu = dynamic(() => import("@/components/layout/UserMenu").then((m) => m.UserMenu), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="ml-1 size-[34px] rounded-full bg-raised" />,
});

const NotificationBell = dynamic(() => import("@/components/social/NotificationBell").then((m) => m.NotificationBell), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="size-10" />,
});

/** Reserves its footprint while the session resolves, so nothing jumps. */
function AccountSlot() {
  const { status } = useAuth();
  if (status === "signed-in") {
    return (
      <>
        <NotificationBell />
        <UserMenu />
      </>
    );
  }
  if (status === "loading") return <span aria-hidden="true" className="ml-1 size-[34px]" />;
  return (
    <DeferredLink href="/signin" className="link-draw ml-1 text-[0.9375rem] text-text">
      Sign in
    </DeferredLink>
  );
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-7">
      {PRIMARY_LINKS.map((link) => {
        const active = pathname != null && isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <DeferredLink
              href={link.href}
              transitionTypes={["nav"]}
              aria-current={active ? "page" : undefined}
              data-fly-target={link.href === "/library" ? "library" : link.href === "/watchlist" ? "watchlist" : undefined}
              className={cn("link-draw inline-block pb-0.5 text-[0.9375rem]", active ? "text-text" : "text-muted hover:text-text")}
            >
              {link.label}
            </DeferredLink>
          </li>
        );
      })}
    </ul>
  );
}

/** Reads the URL, so it lives in its own Suspense boundary: dynamic routes still prerender the rest. */
function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

/** Phones: the dock holds the everyday links and has no room for About, so it sits up here instead. */
function AboutLink({ pathname }: { pathname: string | null }) {
  const active = pathname != null && isActive(pathname, "/about");
  return (
    <DeferredLink
      href="/about"
      transitionTypes={["nav"]}
      aria-current={active ? "page" : undefined}
      className={cn("link-draw mr-1.5 text-[0.9375rem] md:hidden", active ? "text-text" : "text-muted hover:text-text")}
    >
      About
    </DeferredLink>
  );
}

function ActiveAboutLink() {
  return <AboutLink pathname={usePathname()} />;
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 12));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top,0px)]"
      style={{ viewTransitionName: "site-header" }}
    >
      {/* Legibility scrim over heroes; fades out once the solid plate takes over. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-bg/75 to-transparent transition-opacity duration-500",
          scrolled && "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 -z-10 border-b border-hairline bg-bg/95 transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="page flex h-[var(--nav-h)] items-center gap-10">
        <DeferredLink href="/" transitionTypes={["nav"]} aria-label="Reverie, home" className="shrink-0 rounded-full">
          <Logo animate />
        </DeferredLink>

        <nav aria-label="Primary" className="hidden md:block">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:gap-3">
          <Suspense fallback={<AboutLink pathname={null} />}>
            <ActiveAboutLink />
          </Suspense>
          <SearchTrigger className="hidden lg:flex" />
          <ThemeToggle />
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
