import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal";

type Doc = (typeof LEGAL_DOCS)[number]["href"];

/** The shell of the Terms, Privacy and Cookie pages: date, title, a plain summary and the way between them. */
export function LegalPage({ current, title, lede, children }: { current: Doc; title: string; lede: string; children: ReactNode }) {
  return (
    <PageTransition>
      <article className="page pb-[var(--section-y)] pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
        <header className="max-w-[44rem]">
          <p className="caption text-muted">Last updated {LEGAL_UPDATED}</p>
          <h1 className="mt-3 text-h1">{title}</h1>
          <p className="mt-6 text-lead text-text/90">{lede}</p>
          <nav aria-label="Legal" className="mt-8">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-meta">
              {LEGAL_DOCS.map((d) => (
                <li key={d.href}>
                  {d.href === current ? (
                    <span aria-current="page" className="text-text">
                      {d.label}
                    </span>
                  ) : (
                    <Link href={d.href} className="link-draw text-muted hover:text-text">
                      {d.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <div className="mt-14">{children}</div>
      </article>
    </PageTransition>
  );
}

/** One part of a legal page: its title on the left, the words on the right (stacked on phones). */
export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid-editorial scroll-mt-[calc(var(--nav-h)+1.5rem)] gap-y-4 border-t border-hairline py-10 md:py-14">
      <h2 id={`${id}-title`} className="col-span-12 text-h4 md:col-span-4">
        {title}
      </h2>
      <div className="col-span-12 max-w-[62ch] space-y-4 text-muted md:col-span-8 [&_li]:pl-1 [&_strong]:font-normal [&_strong]:text-text [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** A link inside legal copy: in-app with next/link, elsewhere in a new tab. */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return href.startsWith("/") ? (
    <Link href={href} className="link-draw text-text">
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className="link-draw text-text">
      {children}
    </a>
  );
}

/** "Write to us at …", when a support address is configured (SUPPORT_EMAIL). */
export function SupportLine({ email, lead = "Write to us at" }: { email: string | null; lead?: string }) {
  if (!email) return null;
  return (
    <p>
      {lead}{" "}
      <a href={`mailto:${email}`} className="link-draw text-text">
        {email}
      </a>
      .
    </p>
  );
}
