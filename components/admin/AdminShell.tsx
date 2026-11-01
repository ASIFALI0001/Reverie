"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowUUpLeft, ClockCounterClockwise, Gauge, SignOut, UsersThree, type Icon } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

const SECTIONS: { href: string; label: string; icon: Icon; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/users", label: "Users", icon: UsersThree },
  { href: "/admin/audit", label: "Audit log", icon: ClockCounterClockwise },
];

const isCurrent = (pathname: string, s: (typeof SECTIONS)[number]) =>
  s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`);

/**
 * The control room: the app's own type, colour and hairlines, but denser and calmer.
 * A sidebar on desktop, a top bar of tabs on smaller screens.
 */
export function AdminShell({ admin, children }: { admin: { email: string | null; name: string | null }; children: ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-hairline lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-6 lg:py-7">
          {/* The name starts with the words on screen ("Reverie Admin"), so voice control can find it.
              The space keeps those two words apart in the text, too. */}
          <Link href="/admin" aria-label="Reverie Admin, overview" className="flex items-center gap-3">
            <Logo size={22} wordmarkClassName="text-[1.35rem]" />{" "}
            <span className="caption text-muted">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ redirectTo: "/admin/login" })}
            className="inline-flex items-center gap-2 text-meta text-muted hover:text-text lg:hidden"
          >
            <SignOut size={16} weight="light" aria-hidden="true" /> Sign out
          </button>
        </div>

        <nav aria-label="Admin" className="overflow-x-auto px-3 pb-3 lg:flex-1 lg:px-3 lg:pb-0">
          <ul className="flex gap-1 lg:flex-col">
            {SECTIONS.map((s) => {
              const current = isCurrent(pathname, s);
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 whitespace-nowrap rounded-[4px] px-3 py-2.5 text-[0.9375rem] transition-colors duration-150",
                      current ? "bg-text/[0.06] text-text" : "text-muted hover:text-text",
                    )}
                  >
                    {current ? <span aria-hidden="true" className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-accent lg:block" /> : null}
                    <s.icon size={18} weight={current ? "regular" : "light"} aria-hidden="true" />
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden border-t border-hairline px-6 py-5 lg:block">
          <p className="truncate text-meta text-text" title={admin.email ?? undefined}>
            {admin.name ?? admin.email ?? "Administrator"}
          </p>
          {admin.name && admin.email ? <p className="truncate text-meta text-muted">{admin.email}</p> : null}
          <div className="mt-4 flex flex-col items-start gap-2">
            <Link href="/" className="inline-flex items-center gap-2 text-meta text-muted hover:text-text">
              <ArrowUUpLeft size={16} weight="light" aria-hidden="true" /> Back to Reverie
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ redirectTo: "/admin/login" })}
              className="inline-flex items-center gap-2 text-meta text-muted hover:text-text"
            >
              <SignOut size={16} weight="light" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 px-5 py-8 md:px-8 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
