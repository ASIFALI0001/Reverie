"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "@phosphor-icons/react";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMe } from "@/lib/api/me";
import { api } from "@/lib/api/client";
import { tmdbImg } from "@/lib/images/tmdb";
import type { MediaType } from "@/lib/catalog/types";
import type { Provider, ProviderGroups } from "@/lib/catalog/providers";

const ROWS: { key: keyof Pick<ProviderGroups, "stream" | "free" | "rent" | "buy">; label: string }[] = [
  { key: "stream", label: "Stream" },
  { key: "free", label: "Free" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
];

function ProviderLink({ p, href, kind }: { p: Provider; href: string; kind: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-3 rounded-full border border-hairline-strong py-1.5 pl-1.5 pr-4 transition-colors hover:border-text/40"
    >
      <span className="relative size-8 overflow-hidden rounded-full bg-surface">
        <Image src={tmdbImg(p.logoPath, "logo")!} alt="" fill sizes="32px" className="object-cover" />
      </span>
      <span className="text-[0.9375rem]">{p.name}</span>
      <ArrowUpRight size={14} weight="light" className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      <span className="sr-only">
        ({kind} — opens the official listing in a new tab)
      </span>
    </a>
  );
}

/** Official, legal options only (TMDB × JustWatch). Never a download or an unlicensed stream. */
export function WhereToWatch({ mediaType, tmdbId, title }: { mediaType: MediaType; tmdbId: number; title: string }) {
  const { data: me } = useMe();
  const region = me?.region;
  const providers = useQuery({
    queryKey: ["providers", mediaType, tmdbId, region ?? "auto"],
    queryFn: () => api<ProviderGroups>(`/api/titles/${mediaType}/${tmdbId}/providers${region ? `?region=${region}` : ""}`),
    staleTime: 60 * 60_000,
  });
  const regionName = useMemo(() => {
    const code = providers.data?.region;
    if (!code) return null;
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  }, [providers.data?.region]);

  const data = providers.data;
  const rows = data ? ROWS.filter((r) => data[r.key].length > 0) : [];
  const link = data?.link ?? `https://www.themoviedb.org/${mediaType}/${tmdbId}/watch`;

  return (
    <section id="where-to-watch" className="page scroll-mt-24 border-t border-hairline py-[var(--section-y)]">
      <div className="grid-editorial gap-y-10">
        <div className="col-span-12 md:col-span-4">
          <SplitHeading className="text-h2">Where to watch</SplitHeading>
          <p className="mt-4 text-muted">
            {regionName ? <>In {regionName}. </> : null}
            <Link href="/settings" className="link-draw text-text">
              Change region
            </Link>
          </p>
        </div>

        <div className="col-span-12 md:col-span-8">
          {providers.isLoading ? (
            <div className="space-y-5 border-y border-hairline py-5" aria-hidden="true">
              <Skeleton className="h-11 w-72 rounded-full" />
              <Skeleton className="h-11 w-56 rounded-full" />
            </div>
          ) : providers.isError ? (
            <p className="border-y border-hairline py-6 text-muted">Couldn’t load streaming options right now. Try again in a moment.</p>
          ) : rows.length === 0 ? (
            <div className="border-y border-hairline py-6">
              <p className="font-display text-h4">Not streaming {regionName ? `in ${regionName}` : "here"} right now.</p>
              <p className="mt-2 max-w-[48ch] text-muted">
                Add {title} to your watchlist and it’ll show up here the moment it lands on a service.
              </p>
            </div>
          ) : (
            <dl className="divide-y divide-hairline border-y border-hairline">
              {rows.map((row) => (
                <div key={row.key} className="grid gap-4 py-5 sm:grid-cols-[6rem_1fr]">
                  <dt className="caption pt-3">{row.label}</dt>
                  <dd className="flex flex-wrap gap-3">
                    {data![row.key].map((p) => (
                      <ProviderLink key={p.id} p={p} href={link} kind={row.label} />
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-[0.75rem] text-muted">
            Availability from{" "}
            <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer" className="link-draw text-text/80">
              JustWatch
            </a>
            . Links open the official listing.
          </p>
        </div>
      </div>
    </section>
  );
}
