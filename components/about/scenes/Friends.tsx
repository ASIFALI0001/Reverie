"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, PaperPlaneTilt } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { CompareRadar } from "@/components/social/CompareRadar";
import { useGsapScene } from "@/components/about/useGsapScene";
import { RADAR_AXES } from "@/lib/reco/affinity";
import { tmdbImg } from "@/lib/images/tmdb";
import { CAST } from "@/lib/about/cast";
import { titleOf, type SceneProps } from "@/components/about/types";
import { ease, spring } from "@/lib/motion";

// An imagined circle of friends (the story's people are illustrations).
const PEOPLE = [
  { id: "you", name: "You", x: 50, y: 50, tint: "tungsten" },
  { id: "maya", name: "Maya", x: 20, y: 24, tint: "rose" },
  { id: "rahul", name: "Rahul", x: 80, y: 20, tint: "daylight" },
  { id: "leo", name: "Leo", x: 84, y: 76, tint: "sage" },
  { id: "sana", name: "Sana", x: 16, y: 78, tint: "plum" },
] as const;
const LINKS: [string, string, number][] = [
  ["you", "maya", 86],
  ["you", "rahul", 82],
  ["you", "leo", 64],
  ["you", "sana", 71],
  ["maya", "rahul", 77],
];
const at = (id: string) => PEOPLE.find((p) => p.id === id)!;
const radar = (vals: number[]) => RADAR_AXES.map((a, i) => ({ axis: a.axis, value: vals[i]!, evidence: 6 }));

/**
 * 13 · Friends. A constellation: friends joined by lines that draw themselves as you scroll past
 * (scrubbed, not pinned), each line carrying its taste match. Then three small beats: a poster
 * flies off like a paper plane to a friend; two watchlists merge into one ranked by combined
 * match (shared layout animation); and the real compare radar overlays two tastes.
 */
export default function Friends({ data }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGsapScene(ref, !reduced, "once", ({ gsap }, _root, el) => {
    gsap.set(el.querySelectorAll("[data-link]"), { strokeDashoffset: 1 });
    gsap.set(el.querySelectorAll("[data-pct]"), { opacity: 0 });
    const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: el, start: "top 80%", end: "top 25%", scrub: 0.5 } });
    tl.to(el.querySelectorAll("[data-link]"), { strokeDashoffset: 0, duration: 0.5, stagger: 0.1 }, 0).to(el.querySelectorAll("[data-pct]"), { opacity: 1, duration: 0.2, stagger: 0.1 }, 0.3);
  });

  return (
    <div ref={ref} className="w-full">
      <div className="relative mx-auto aspect-[16/10] w-[min(92vw,40rem)]">
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
          {LINKS.map(([a, b]) => (
            <line key={`${a}-${b}`} data-link x1={at(a).x} y1={at(a).y} x2={at(b).x} y2={at(b).y} pathLength={1} strokeDasharray="1" stroke="var(--color-hairline-strong)" strokeWidth="0.35" />
          ))}
        </svg>
        {LINKS.map(([a, b, pct]) => (
          <span key={`p-${a}-${b}`} data-pct aria-hidden="true" className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg px-1.5 font-mono text-[0.6875rem] text-muted" style={{ left: `${(at(a).x + at(b).x) / 2}%`, top: `${(at(a).y + at(b).y) / 2}%` }}>
            {pct}%
          </span>
        ))}
        <ul aria-label="Friends and their taste match with you">
          {PEOPLE.map((p) => (
            <li key={p.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <Avatar name={p.name} avatar={{ kind: "monogram", tint: p.tint }} size={p.id === "you" ? 64 : 48} />
              <span className="text-[0.8125rem]">{p.name}</span>
              {p.id !== "you" ? <span className="sr-only">{LINKS.find((l) => l[0] === "you" && l[1] === p.id)?.[2] ?? ""}% match</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        <SendBeat poster={titleOf(data, CAST.plane)?.posterPath ?? null} still={!!reduced} />
        <MergeBeat data={data} still={!!reduced} />
        <CompareBeat />
      </div>
    </div>
  );
}

function Beat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col rounded-[6px] border border-hairline bg-surface/60 p-5">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="mt-4 flex flex-1 flex-col justify-center">{children}</div>
    </section>
  );
}

function SendBeat({ poster, still }: { poster: string | null; still: boolean }) {
  return (
    <Beat title="Send to a friend">
      <div className="relative flex h-40 items-center justify-between">
        {poster ? (
          <motion.div
            className="relative aspect-[2/3] w-20 overflow-hidden rounded-[2px] shadow-[0_14px_30px_rgb(0_0_0/0.4)]"
            initial={false}
            whileInView={still ? undefined : { x: [0, 60, 150], y: [0, -56, -14], rotate: [0, -22, 14], scale: [1, 0.55, 0.18], opacity: [1, 1, 0] }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 1.6, ease: ease.out, delay: 0.4 }}
          >
            <Image src={tmdbImg(poster, "thumb")!} alt="" fill sizes="80px" className="object-cover" />
          </motion.div>
        ) : null}
        <PaperPlaneTilt size={20} weight="light" className="text-muted" aria-hidden="true" />
        <Avatar name="Maya" avatar={{ kind: "monogram", tint: "rose" }} size={48} />
      </div>
      <motion.p className="mt-3 inline-flex items-center gap-1.5 text-[0.875rem]" initial={still ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: still ? 0 : 2 }}>
        <Check size={14} weight="bold" className="text-accent" aria-hidden="true" /> Sent to Maya, with a note
      </motion.p>
    </Beat>
  );
}

function MergeBeat({ data, still }: { data: SceneProps["data"]; still: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.7 });
  const [merged, setMerged] = useState(still);
  useEffect(() => {
    if (!seen || merged) return;
    const t = window.setTimeout(() => setMerged(true), 1400);
    return () => window.clearTimeout(t);
  }, [seen, merged]);
  const [a, b, c, d] = CAST.watchlist.map((k) => titleOf(data, k));
  const yours = [a, b, c].filter(Boolean);
  const hers = [c, d].filter(Boolean);
  // Combined match: everyone's view counts, and a low one counts double (the real formula, rounded).
  const together = [
    { t: c, m: 84 },
    { t: a, m: 79 },
    { t: d, m: 71 },
    { t: b, m: 58 },
  ].filter((x) => x.t);
  const row = (t: NonNullable<typeof a>, id: string, m?: number) => (
    <motion.li key={id} layoutId={id} transition={spring.soft} className="flex items-center gap-2 text-[0.8125rem]">
      <span className="relative aspect-[2/3] w-6 shrink-0 overflow-hidden rounded-[2px] bg-raised">
        <Image src={tmdbImg(t.posterPath, "thumb")!} alt="" fill sizes="24px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1 truncate">{t.title}</span>
      {m != null ? <span className="numeral text-muted">{m}%</span> : null}
    </motion.li>
  );
  return (
    <Beat title="A shared watchlist">
      <div ref={ref}>
        {merged ? (
          <ol className="space-y-2">{together.map((x) => row(x.t!, x.t!.key, x.m))}</ol>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <ol className="space-y-2">{yours.map((t) => row(t!, t!.key))}</ol>
            <ol className="space-y-2">{hers.map((t) => row(t!, t === c ? `${t!.key}-hers` : t!.key))}</ol>
          </div>
        )}
        <p className="mt-3 text-meta text-muted">{merged ? "Ranked by combined match" : "Yours and Maya’s"}</p>
      </div>
    </Beat>
  );
}

function CompareBeat() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  return (
    <Beat title="Compare tastes">
      <div ref={ref} className="min-h-48">
        {seen ? <CompareRadar mine={radar([0.85, 0.6, 0.55, 0.3, 0.2, 0.8, 0.9, 0.4])} theirs={radar([0.6, 0.75, 0.7, 0.65, 0.15, 0.7, 0.55, 0.45])} theirName="Maya" /> : null}
      </div>
    </Beat>
  );
}
