import Image from "next/image";
import Link from "next/link";
import { Rail } from "@/components/rails/Rail";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { getCollectionTimeline } from "@/lib/title-page";
import { tmdbImg } from "@/lib/images/tmdb";
import { cn } from "@/lib/cn";

/** The franchise in release order — a real sequence, so it's numbered. */
export async function FranchiseTimeline({ collectionId, currentKey }: { collectionId: number; currentKey: string }) {
  const timeline = await getCollectionTimeline(collectionId);
  if (!timeline || timeline.parts.length < 2) return null;

  return (
    <section className="border-t border-hairline py-[var(--section-y)]">
      <Rail
        label={`${timeline.name} in release order`}
        heading={
          <SplitHeading className="text-h2">
            Part of <em>{timeline.name}</em>
          </SplitHeading>
        }
      >
        {timeline.parts.map((p, i) => {
          const current = p.key === currentKey;
          return (
            <li key={p.key} className="w-[8.5rem] shrink-0 md:w-[10rem]">
              <Link href={p.href} aria-current={current ? "page" : undefined} className="group block" draggable={false}>
                <div className="flex items-center gap-3">
                  <span className="numeral text-meta text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className={cn("h-px flex-1", current ? "bg-[var(--tint)]" : "bg-hairline-strong")} />
                </div>
                <div
                  className={cn(
                    "relative mt-3 aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-surface",
                    current && "ring-1 ring-[var(--tint)] ring-offset-4 ring-offset-bg",
                    !p.released && "opacity-50",
                  )}
                >
                  {p.posterPath ? (
                    <Image
                      src={tmdbImg(p.posterPath)!}
                      alt={`${p.title} poster`}
                      fill
                      sizes="160px"
                      draggable={false}
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-snug">{p.title}</p>
                <p className="mt-0.5 text-meta text-muted">
                  {current ? <span className="text-[var(--tint)]">You’re here · </span> : null}
                  {p.year ?? "Upcoming"}
                </p>
              </Link>
            </li>
          );
        })}
      </Rail>
    </section>
  );
}
