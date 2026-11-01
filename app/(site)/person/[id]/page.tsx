import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/motion/PageTransition";
import { Biography, Filmography, KnownForRail } from "@/components/person/PersonParts";
import { Skeleton } from "@/components/ui/Skeleton";
import { initials } from "@/components/ui/Avatar";
import { getPersonPage } from "@/lib/person-page";
import { excerpt } from "@/lib/catalog/normalize";
import { tmdbImg, tmdbImgUrl } from "@/lib/images/tmdb";

type Props = PageProps<"/person/[id]">;

const idOf = (raw: string) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idOf((await params).id);
  const p = id ? await getPersonPage(id) : null;
  if (!p) return { title: "Person not found" };
  const image = tmdbImgUrl(p.profilePath, "h632");
  return {
    title: p.name,
    description: p.biography ? excerpt(p.biography, 180) : `${p.name}: filmography and the titles they’re known for.`,
    openGraph: image ? { images: [{ url: image }] } : undefined,
  };
}

export default function PersonPageRoute({ params }: Props) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <PersonContent params={params} />
    </Suspense>
  );
}

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

async function PersonContent({ params }: { params: Props["params"] }) {
  const id = idOf((await params).id);
  const p = id ? await getPersonPage(id) : null;
  if (!p) notFound();

  const life = [
    p.birthday ? `Born ${fmtDate(p.birthday)}${p.placeOfBirth ? `, ${p.placeOfBirth}` : ""}` : null,
    p.deathday ? `Died ${fmtDate(p.deathday)}` : null,
  ].filter(Boolean);

  return (
    <PageTransition>
      <article className="pb-[var(--section-y)] pt-[calc(var(--nav-h)+2.5rem)] md:pt-[calc(var(--nav-h)+4.5rem)]">
        <header className="page grid gap-8 md:grid-cols-[clamp(11rem,22vw,17rem)_minmax(0,1fr)] md:items-end md:gap-14">
          <div className="relative aspect-[2/3] w-[min(46vw,13rem)] overflow-hidden rounded-[2px] bg-surface md:w-full">
            {p.profilePath ? (
              <Image src={tmdbImg(p.profilePath, "poster")!} alt="" fill priority sizes="(min-width: 768px) 272px, 46vw" className="object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-full place-items-center font-display text-h1 text-muted">
                {initials(p.name)}
              </span>
            )}
          </div>
          <div>
            <p className="caption text-muted">{p.department}</p>
            <h1 className="mt-3 max-w-[14ch] text-display">{p.name}</h1>
            {life.length ? <p className="mt-5 text-meta text-muted">{life.join(" · ")}</p> : null}
          </div>
        </header>

        {p.biography ? (
          <section className="page mt-14 grid gap-6 md:grid-cols-[clamp(11rem,22vw,17rem)_minmax(0,1fr)] md:gap-14" aria-label="Biography">
            <h2 className="caption pt-1.5 text-muted">Biography</h2>
            <div className="max-w-[64ch]">
              <Biography text={p.biography} />
            </div>
          </section>
        ) : null}

        {p.knownFor.length ? (
          <section className="mt-[var(--section-y)]">
            <KnownForRail credits={p.knownFor} />
          </section>
        ) : null}

        {p.credits.length ? (
          <section className="page mt-[var(--section-y)]" aria-labelledby="filmography">
            <h2 id="filmography" className="font-display text-h2">
              Filmography
            </h2>
            <div className="mt-8">
              <Filmography credits={p.credits} />
            </div>
          </section>
        ) : null}
      </article>
    </PageTransition>
  );
}

function PersonSkeleton() {
  return (
    <div className="page pt-[calc(var(--nav-h)+4.5rem)]" aria-hidden="true">
      <div className="grid gap-8 md:grid-cols-[clamp(11rem,22vw,17rem)_minmax(0,1fr)] md:items-end md:gap-14">
        <Skeleton className="aspect-[2/3] w-[min(46vw,13rem)] md:w-full" />
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-[clamp(3rem,8vw,7rem)] w-3/4" />
        </div>
      </div>
    </div>
  );
}
