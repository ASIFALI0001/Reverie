"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Share links exist for their preview card; people go straight on to the title. */
export function ShareRedirect({ href, title }: { href: string; title: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return (
    <p className="page pt-[calc(var(--nav-h)+5rem)] text-muted">
      Opening{" "}
      <Link href={href} className="link-draw text-text">
        {title}
      </Link>
      …
    </p>
  );
}
