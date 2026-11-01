import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ShareRedirect } from "@/components/title/ShareRedirect";
import { getTitlePage } from "@/lib/title-page";
import { titleHref } from "@/lib/catalog/links";

type Props = PageProps<"/share/[mediaType]/[id]/[match]">;

async function read(params: Props["params"]) {
  const { mediaType, id, match } = await params;
  const tmdbId = Number(id);
  const m = Number(match);
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(m) || m < 1 || m > 99) return null;
  const data = await getTitlePage(mediaType, tmdbId);
  return data ? { data, match: m } : null;
}

/** The point of a share link: a preview card that carries the sharer's match. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await read(params);
  if (!r) return { title: "Not found" };
  const name = `${r.data.title}${r.data.year ? ` (${r.data.year})` : ""}`;
  // "An 87%", "a 92%": the article follows how the number sounds.
  const article = r.match === 11 || r.match === 18 || String(r.match).startsWith("8") ? "an" : "a";
  const title = `${name}: ${article} ${r.match}% match`;
  const description = "Reverie scored this title against a viewer’s own taste. See how much you’d like it.";
  const image = { url: `/api/og/${r.data.mediaType}/${r.data.tmdbId}?m=${r.match}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false },
    alternates: { canonical: titleHref(r.data.mediaType, r.data.tmdbId, r.data.title) },
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default function SharePage({ params }: Props) {
  return (
    <Suspense>
      <Share params={params} />
    </Suspense>
  );
}

async function Share({ params }: { params: Props["params"] }) {
  const r = await read(params);
  if (!r) notFound();
  return <ShareRedirect href={titleHref(r.data.mediaType, r.data.tmdbId, r.data.title)} title={r.data.title} />;
}
