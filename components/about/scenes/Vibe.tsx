"use client";

/* eslint-disable @next/next/no-img-element -- YouTube thumbnails come straight from i.ytimg.com, as on title pages */
import Image from "next/image";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { Play } from "@phosphor-icons/react";
import { useGsapScene } from "@/components/about/useGsapScene";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";

const TABS = ["Trailers", "Edits", "Reviews", "Explained"];

/**
 * 08 · Watch the vibe. A mini title page assembles itself when it arrives (a timeline that plays
 * once, not scrubbed): the backdrop settles out of a slow zoom, the title wipes in, the ratings
 * count up, then the tabs and a strip of real video thumbnails slide in from the right. Hovering
 * a thumbnail zooms it gently. Reduced motion: the finished page.
 */
export default function Vibe({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const t = titleOf(data, CAST.vibe);
  const ratings = [
    { label: "IMDb", value: t?.ratings?.imdb ?? null, suffix: "", decimals: 1 },
    { label: "Rotten Tomatoes", value: t?.ratings?.rottenTomatoes ?? null, suffix: "%", decimals: 0 },
    { label: "Metacritic", value: t?.ratings?.metacritic ?? null, suffix: "", decimals: 0 },
  ].filter((r) => r.value != null);
  const videos = (t?.videos ?? []).slice(0, 4);

  useGsapScene(ref, !reduced, "once", ({ gsap }, _root, el) => {
    const nums = [...el.querySelectorAll<HTMLElement>("[data-num]")];
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 72%", toggleActions: "play none none none" } });
    tl.from(el.querySelector("[data-backdrop]"), { scale: 1.18, opacity: 0, duration: 1.6, ease: "expo.out" })
      .from(el.querySelector("[data-title]"), { clipPath: "inset(0 100% 0 0)", duration: 0.9, ease: "power3.inOut" }, 0.45)
      .from(el.querySelector("[data-meta]"), { opacity: 0, y: 10, duration: 0.6, ease: "expo.out" }, 0.9);
    nums.forEach((n) => {
      const to = Number(n.dataset.to);
      const decimals = Number(n.dataset.decimals);
      const c = { v: 0 };
      tl.to(c, { v: to, duration: 1.2, ease: "expo.out", onUpdate: () => void (n.textContent = `${c.v.toFixed(decimals)}${n.dataset.suffix ?? ""}`) }, 1.0);
    });
    tl.from(el.querySelectorAll("[data-tab]"), { opacity: 0, y: 8, duration: 0.4, stagger: 0.06, ease: "expo.out" }, 1.4).from(
      el.querySelectorAll("[data-thumb]"),
      { x: 160, opacity: 0, duration: 0.9, stagger: 0.08, ease: "expo.out" },
      1.5,
    );
  });

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-[6px] border border-hairline bg-surface">
      <div className="relative aspect-[16/9] md:aspect-[2.2/1]">
        {t?.backdropPath ? (
          <div data-backdrop className="absolute inset-0">
            <Image src={tmdbImg(t.backdropPath, "backdrop")!} alt="" fill sizes="(min-width: 1024px) 56rem, 100vw" className="object-cover" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
          <p data-title className="font-display text-[clamp(2rem,5vw,3.75rem)] leading-[0.95]">
            {t?.title ?? "Dune: Part Two"}
          </p>
          <p data-meta className="mt-2 text-meta text-muted">
            {[t?.year, t?.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
          </p>
          {ratings.length ? (
            <dl className="mt-4 flex gap-6">
              {ratings.map((r) => (
                <div key={r.label}>
                  <dt className="text-[0.75rem] text-muted">{r.label}</dt>
                  <dd className="numeral text-[1.375rem]" data-num data-to={r.value!} data-decimals={r.decimals} data-suffix={r.suffix}>
                    {`${r.value!.toFixed(r.decimals)}${r.suffix}`}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
      <div className="p-5 md:p-8">
        <ul aria-label="Video tabs" className="flex gap-5 border-b border-hairline">
          {TABS.map((tab, i) => (
            <li key={tab} data-tab className={i === 0 ? "-mb-px border-b-2 border-accent pb-2.5 text-[0.9375rem] text-text" : "pb-2.5 text-[0.9375rem] text-muted"}>
              {tab}
            </li>
          ))}
        </ul>
        {videos.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {videos.map((v) => (
              <li key={v.key} data-thumb className="group">
                <div className="relative aspect-video overflow-hidden rounded-[4px] bg-raised">
                  <img src={`https://i.ytimg.com/vi/${v.key}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
                    <span className="grid size-9 place-items-center rounded-full bg-bg/70 text-text">
                      <Play size={14} weight="fill" />
                    </span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-snug text-muted">{v.name}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
