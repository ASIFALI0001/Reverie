"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  FilmStrip,
  House,
  MagnifyingGlass,
  UserCircle,
  type Icon,
} from "@phosphor-icons/react";
import { isActive } from "@/components/layout/nav-links";
import { DeferredLink } from "@/components/ui/DeferredLink";
import { cn } from "@/lib/cn";

const ITEMS: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: MagnifyingGlass },
  { href: "/library", label: "Library", icon: FilmStrip },
  { href: "/watchlist", label: "Watchlist", icon: BookmarkSimple },
  { href: "/settings", label: "You", icon: UserCircle },
];

function DockItems({ pathname }: { pathname: string | null }) {
  return (
    <ul className="grid h-[var(--dock-h)] grid-cols-5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname != null && isActive(pathname, href);
        return (
          <li key={href} className="contents">
            <DeferredLink
              href={href}
              transitionTypes={["nav"]}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[0.6875rem] tracking-[0.01em] transition-colors duration-150",
                active ? "text-text" : "text-muted",
              )}
            >
              <span data-fly-target={href === "/library" ? "library" : href === "/watchlist" ? "watchlist" : undefined} className="inline-grid">
                <Icon size={22} weight={active ? "fill" : "light"} aria-hidden="true" />
              </span>
              {label}
            </DeferredLink>
          </li>
        );
      })}
    </ul>
  );
}

/** Reads the URL inside its own boundary so dynamic routes keep a prerendered shell. */
function ActiveDockItems() {
  return <DockItems pathname={usePathname()} />;
}

/** Thumb-reach navigation for phones. Hidden from md up, where the top bar carries the links. */
export function Dock() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      <Suspense fallback={<DockItems pathname={null} />}>
        <ActiveDockItems />
      </Suspense>
    </nav>
  );
}
