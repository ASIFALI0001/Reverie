import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { TitleHero } from "@/components/title/TitleHero";
import { HeroPlaceholder } from "@/components/title/HeroPlaceholder";
import { StorySection } from "@/components/title/StorySection";
import { WhereToWatch } from "@/components/title/WhereToWatch";
import { CastSection } from "@/components/title/CastSection";
import { WatchTheVibe } from "@/components/title/WatchTheVibe";
import { FranchiseTimeline } from "@/components/title/FranchiseTimeline";
import { MoreLikeThis } from "@/components/title/MoreLikeThis";
import { YourMatch } from "@/components/title/YourMatch";
import { ReviewsSection } from "@/components/title/ReviewsSection";
import { TitleJsonLd } from "@/components/title/TitleJsonLd";
import { PageTransition } from "@/components/motion/PageTransition";
import { HeroActions } from "@/components/title/HeroActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { getTitlePage, popularTitleParams } from "@/lib/title-page";
import { idFromSlug, isMediaType, titleHref } from "@/lib/catalog/links";
import { env } from "@/lib/env";

type Props = PageProps<"/title/[mediaType]/[slug]">;

export async function generateStaticParams() {
  return popularTitleParams(40);
}

async function load(params: Props["params"]) {
  const { mediaType, slug } = await params;
  const id = idFromSlug(slug);
  if (!isMediaType(mediaType) || !id) return null;
  return { mediaType, slug, id, data: await getTitlePage(mediaType, id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params);
  if (!r?.data) return { title: "Title not found" };
  const { data } = r;
  const name = `${data.title}${data.year ? ` (${data.year})` : ""}`;
  const description = (data.vibe?.summary ?? data.overview).slice(0, 300) || undefined;
  return {
    title: name,
    description,
    alternates: { canonical: titleHref(data.mediaType, data.tmdbId, data.title) },
    openGraph: {
      title: name,
      description,
      type: data.mediaType === "movie" ? "video.movie" : "video.tv_show",
      images: [{ url: `/api/og/${data.mediaType}/${data.tmdbId}`, width: 1200, height: 630, alt: name }],
    },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default function TitlePage(props: Props) {
  // Params are awaited inside the boundary: unlisted titles still get the instant shell.
  return (
    <PageTransition>
      <Suspense
        fallback={
          <Suspense fallback={<HeroPlaceholder generic />}>
            <HeroPlaceholder />
          </Suspense>
        }
      >
        <TitleContent params={props.params} />
      </Suspense>
    </PageTransition>
  );
}

function SectionSkeleton() {
  return (
    <div className="page border-t border-hairline py-[var(--section-y)]" aria-hidden="true">
      <Skeleton className="h-12 w-64" />
      <div className="mt-10 flex gap-[var(--gutter)] overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-[clamp(9.5rem,15vw,13.75rem)] shrink-0" />
        ))}
      </div>
    </div>
  );
}

async function TitleContent({ params }: { params: Props["params"] }) {
  const r = await load(params);
  if (!r?.data) notFound();
  const { data, slug } = r;
  const canonical = titleHref(data.mediaType, data.tmdbId, data.title);
  if (`/title/${data.mediaType}/${slug}` !== canonical) permanentRedirect(canonical);

  const accent = {
    "--tint-dark": data.colors?.accentDark,
    "--tint-light": data.colors?.accentLight,
  } as CSSProperties;

  return (
    <article className="title-page" style={accent}>
      <TitleJsonLd data={data} url={`${env.siteUrl()}${canonical}`} />
      <TitleHero
        data={data}
        certRegion={env.defaultRegion()}
        actions={<HeroActions mediaType={data.mediaType} tmdbId={data.tmdbId} title={data.title} posterPath={data.posterPath} path={canonical} askContinue />}
      />
      <YourMatch mediaType={data.mediaType} tmdbId={data.tmdbId} kind={data.mediaType === "tv" ? "show" : "film"} />
      <StorySection overview={data.overview} tagline={data.tagline} vibe={data.vibe} />
      <div className="defer-render">
        <WhereToWatch mediaType={data.mediaType} tmdbId={data.tmdbId} title={data.title} />
      </div>
      <div className="defer-render">
        <CastSection crew={data.mediaType === "tv" && data.creators.length ? data.creators : data.directors} cast={data.topCast} />
      </div>
      <div className="defer-render">
        <WatchTheVibe mediaType={data.mediaType} tmdbId={data.tmdbId} title={data.title} />
      </div>
      {data.collection ? (
        <div className="defer-render">
          <Suspense fallback={<SectionSkeleton />}>
            <FranchiseTimeline collectionId={data.collection.id} currentKey={data.key} />
          </Suspense>
        </div>
      ) : null}
      <div className="defer-render">
        <MoreLikeThis mediaType={data.mediaType} tmdbId={data.tmdbId} />
      </div>
      <div className="defer-render">
        <ReviewsSection reviews={data.reviews} />
      </div>
    </article>
  );
}
