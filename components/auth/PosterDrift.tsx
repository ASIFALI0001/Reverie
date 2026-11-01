import Image from "next/image";
import type { CSSProperties } from "react";
import { getShowcasePosters } from "@/lib/catalog/showcase";
import { tmdbImg } from "@/lib/images/tmdb";

/** Three columns of posters drifting at different speeds — the projection booth seen sideways. */
export async function PosterDrift() {
  const posters = await getShowcasePosters(30);
  if (posters.length < 9) return <div className="absolute inset-0 bg-surface" />;
  const columns = [0, 1, 2].map((c) => posters.filter((_, i) => i % 3 === c));

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 grid grid-cols-3 gap-4 px-4 opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]">
        {columns.map((col, i) => (
          <div
            key={i}
            className="drift flex flex-col gap-4"
            data-dir={i === 1 ? "down" : "up"}
            style={{ "--drift-dur": `${150 + i * 35}s` } as CSSProperties}
          >
            {[...col, ...col].map((p, j) => (
              <div key={`${p.mediaType}-${p.id}-${j}`} className="relative aspect-[2/3] shrink-0 overflow-hidden rounded-[var(--radius-poster)] bg-surface">
                <Image
                  src={tmdbImg(p.posterPath)!}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 17vw, 1px"
                  // The reversed column opens on its second copy, so eager-load by position in each copy.
                  loading={j % col.length < 4 ? "eager" : "lazy"}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Blend into the form side and dim like a house light going down. */}
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-bg/10 to-bg" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-bg via-bg/70 to-transparent" />
      <p className="absolute bottom-12 left-12 max-w-[20ch] font-display text-h3 leading-[1.02] text-text">
        Tonight’s line-up, ranked for one person: <em>you.</em>
      </p>
    </div>
  );
}

/** Phone version: a single row sliding sideways above the form. */
export async function PosterBand() {
  const posters = (await getShowcasePosters(30)).slice(0, 14);
  if (posters.length < 6) return null;
  return (
    <div
      aria-hidden="true"
      className="relative -mx-[var(--page-x)] mb-10 h-28 overflow-hidden opacity-80 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] lg:hidden"
    >
      <div className="drift-x flex w-max gap-3" style={{ "--drift-dur": "80s" } as CSSProperties}>
        {[...posters, ...posters].map((p, j) => (
          <div key={`${p.id}-${j}`} className="relative h-28 w-[4.65rem] shrink-0 overflow-hidden rounded-[var(--radius-poster)] bg-surface">
            <Image src={tmdbImg(p.posterPath, "thumb")!} alt="" fill sizes="76px" loading={j % posters.length < 6 ? "eager" : "lazy"} className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
