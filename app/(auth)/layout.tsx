import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PosterBand, PosterDrift } from "@/components/auth/PosterDrift";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    // minmax(0,…) stops the poster band's long row from widening the column on phones.
    <div className="grid min-h-[100svh] grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <aside aria-hidden="true" className="relative hidden overflow-hidden lg:block">
        <PosterDrift />
      </aside>

      <div className="flex min-h-[100svh] flex-col">
        <header className="flex h-[var(--nav-h)] items-center justify-between px-[var(--page-x)] lg:px-14">
          <Link href="/" aria-label="Reverie, home" className="rounded-full">
            <Logo animate />
          </Link>
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 flex-col justify-center px-[var(--page-x)] pb-16 pt-6 lg:px-14">
          <PosterBand />
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
