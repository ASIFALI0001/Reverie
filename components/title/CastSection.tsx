import Image from "next/image";
import Link from "next/link";
import { Rail } from "@/components/rails/Rail";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { initials } from "@/components/ui/Avatar";
import { tmdbImg } from "@/lib/images/tmdb";
import type { Person } from "@/lib/catalog/types";

export function CastSection({ crew, cast }: { crew: Person[]; cast: Person[] }) {
  const people = [...crew, ...cast].filter((p, i, a) => a.findIndex((q) => q.id === p.id && q.job === p.job) === i);
  if (people.length === 0) return null;
  return (
    <section className="border-t border-hairline py-[var(--section-y)]">
      <Rail label="Cast and crew" heading={<SplitHeading className="text-h2">Cast &amp; crew</SplitHeading>}>
        {people.map((p) => (
          <li key={`${p.id}-${p.job ?? "cast"}`} className="w-[7.5rem] shrink-0 md:w-[8.5rem]">
            <Link href={`/person/${p.id}`} transitionTypes={["nav-forward"]} className="group block text-center" draggable={false}>
              <div className="relative mx-auto size-24 overflow-hidden rounded-full bg-surface md:size-28">
                {p.profilePath ? (
                  <Image
                    src={tmdbImg(p.profilePath, "profile")!}
                    alt=""
                    fill
                    sizes="112px"
                    draggable={false}
                    className="object-cover grayscale-[35%] transition-[filter,transform] duration-500 ease-out group-hover:scale-105 group-hover:grayscale-0"
                  />
                ) : (
                  <span aria-hidden="true" className="grid size-full place-items-center font-display text-h3 text-muted">
                    {initials(p.name)}
                  </span>
                )}
              </div>
              <p className="mt-3 text-[0.9375rem] leading-snug group-hover:underline">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-meta text-muted">{p.job && p.job !== "Cast" ? p.job : p.character}</p>
            </Link>
          </li>
        ))}
      </Rail>
    </section>
  );
}
