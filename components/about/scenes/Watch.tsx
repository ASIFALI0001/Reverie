"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";

/**
 * 14 · Where to watch. Real providers for the region (TMDB, from JustWatch) fly in from scattered
 * places and snap into rows under the poster on a spring: Stream, Rent, Buy. Reduced motion:
 * already in their rows.
 */
export default function Watch({ data }: SceneProps) {
  const reduced = useReducedMotion();
  const poster = titleOf(data, CAST.match);
  const p = data?.providers;
  const rows = [
    { label: "Stream", items: p?.stream ?? [] },
    { label: "Rent", items: p?.rent ?? [] },
    { label: "Buy", items: p?.buy ?? [] },
  ].filter((r) => r.items.length);
  let n = 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center">
      {poster?.posterPath ? (
        <div className="relative aspect-[2/3] w-[clamp(8rem,16vw,11rem)] overflow-hidden rounded-[2px] shadow-[0_30px_70px_rgb(0_0_0/0.5)]">
          <Image src={tmdbImg(poster.posterPath)!} alt={poster.title} fill sizes="11rem" className="object-cover" />
        </div>
      ) : null}
      <dl className="mt-10 w-full space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 border-b border-hairline pb-4">
            <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{r.label}</dt>
            <dd>
              <ul className="flex flex-wrap gap-2.5">
                {r.items.map((s) => {
                  const k = n++;
                  return (
                    <motion.li
                      key={`${r.label}-${s.name}`}
                      initial={reduced ? false : { x: ((k * 97) % 300) - 150, y: ((k * 53) % 160) - 120, rotate: ((k * 37) % 50) - 25, opacity: 0 }}
                      whileInView={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18, delay: k * 0.05 }}
                      className="relative size-11 overflow-hidden rounded-[10px] bg-raised"
                      title={s.name}
                    >
                      <Image src={tmdbImg(s.logoPath, "logo")!} alt={s.name} fill sizes="44px" className="object-cover" />
                    </motion.li>
                  );
                })}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-meta text-muted">
        {p ? `${p.title} in ${p.region}. ` : ""}Where-to-watch data from JustWatch, via TMDB. Every link goes to an official service.
      </p>
    </div>
  );
}
