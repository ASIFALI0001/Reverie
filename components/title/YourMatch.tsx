"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { FriendsOnTitle } from "@/components/social/FriendsOnTitle";
import { TwinsOnTitle } from "@/components/twins/TwinsOnTitle";
import { WHY_NOT_BELOW, WhyNot } from "@/components/title/WhyNot";
import { useMatch } from "@/lib/api/match";
import { toast } from "@/lib/store/toast";
import { ShareNetwork } from "@phosphor-icons/react";
import { tmdbImg } from "@/lib/images/tmdb";
import { ease } from "@/lib/motion";
import type { MediaType } from "@/lib/catalog/types";

/** Share a link whose preview card shows your match (crawlers can't see personal data otherwise). */
function ShareMatch({ mediaType, tmdbId, score }: { mediaType: MediaType; tmdbId: number; score: number }) {
  async function share() {
    const url = `${window.location.origin}/share/${mediaType}/${tmdbId}/${score}`;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Its preview shows your match." });
    } catch (err) {
      // Closing the share sheet isn't an error worth a toast.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast({ title: "Couldn’t share that link", tone: "error" });
    }
  }
  return (
    <button type="button" onClick={share} className="link-draw mt-8 inline-flex items-center gap-2 text-meta text-muted hover:text-text">
      <ShareNetwork size={16} aria-hidden="true" /> Share my match
    </button>
  );
}

/**
 * Why the dial reads what it reads: three reasons grounded in the viewer's own
 * history, one honest caveat, and the titles it leaned on.
 */
export function YourMatch({ mediaType, tmdbId, kind }: { mediaType: MediaType; tmdbId: number; kind: "film" | "show" }) {
  const { status } = useAuth();
  const match = useMatch(mediaType, tmdbId);
  const reduced = useReducedMotion();
  if (status !== "signed-in" || match.isError) return null;

  if (match.isPending) {
    return (
      <section className="page py-[calc(var(--section-y)*0.6)]" aria-busy="true" aria-label="Your match">
        <p className="caption text-muted">Your match</p>
        <p className="mt-3 font-display text-h3 text-muted">Reading your taste against this one…</p>
        <div className="relative mt-6 h-px w-full max-w-md overflow-hidden bg-hairline-strong">
          <span className="beam" />
        </div>
      </section>
    );
  }

  const d = match.data;
  if (d?.status !== "ok") return null;
  // Below 70%, honesty first: why it might not be for you, with the titles it rests on.
  const low = d.score < WHY_NOT_BELOW;

  // The in-view trigger lives on the section: a line pushed out of its own mask is
  // clipped to nothing, so it would never register as visible itself.
  const rise = (i: number) => ({
    variants: {
      hidden: reduced ? { opacity: 0 } : { y: "105%" },
      shown: reduced ? { opacity: 1 } : { y: 0 },
    },
    transition: { duration: 0.85, ease: ease.out, delay: 0.1 + i * 0.09 },
  });

  return (
    <motion.section
      className="page py-[var(--section-y)]"
      aria-labelledby="your-match"
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
    >
      <div className="grid-editorial gap-y-12">
        <div className="col-span-12 lg:col-span-7">
          <p className="caption text-muted">
            Your match · <span className="numeral text-text">{d.score}%</span>
            {d.learning ? " · getting to know you" : ""}
          </p>
          {low ? (
            <WhyNot mediaType={mediaType} tmdbId={tmdbId} fallbackReasons={d.reasons} />
          ) : (
            <>
              <h2 id="your-match" className="mt-3 overflow-hidden text-h2">
                <motion.span className="block" {...rise(0)}>
                  Why it’s your kind of <em>{kind}</em>
                </motion.span>
              </h2>
              <ul className="mt-8 border-t border-hairline">
                {d.reasons.map((r, i) => (
                  <li key={r} className="overflow-hidden border-b border-hairline py-4">
                    <motion.p className="font-display text-[clamp(1.25rem,2vw,1.625rem)] leading-snug" {...rise(i + 1)}>
                      {r}
                    </motion.p>
                  </li>
                ))}
              </ul>
              {d.watchOut ? (
                <div className="mt-8 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
                  <p className="caption pt-1 text-muted">Worth knowing</p>
                  <p className="max-w-[54ch] text-muted">{d.watchOut}</p>
                </div>
              ) : null}
            </>
          )}
          {d.quick ? (
            <p className="mt-6 text-meta text-muted">A quick read from your taste profile. The full one will be here next time you visit.</p>
          ) : null}
          <FriendsOnTitle data={d.friends} kind={kind} />
          <TwinsOnTitle data={d.twins} kind={kind} />
          <ShareMatch mediaType={mediaType} tmdbId={tmdbId} score={d.score} />
        </div>

        {!low && d.becauseYouLiked.length ? (
          <aside className="col-span-12 lg:col-span-4 lg:col-start-9" aria-label="Because you liked">
            <p className="caption text-muted">Because you liked</p>
            <ul className="mt-4 flex gap-4">
              {d.becauseYouLiked.map((b) => (
                <li key={b.key} className="w-[5.5rem] shrink-0">
                  <Link href={b.href} className="group block">
                    <span className="relative block aspect-[2/3] overflow-hidden rounded-[2px] bg-surface">
                      {b.posterPath ? (
                        <Image
                          src={tmdbImg(b.posterPath, "thumb")!}
                          alt=""
                          fill
                          sizes="88px"
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 line-clamp-2 block text-meta text-muted transition-colors group-hover:text-text">{b.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </motion.section>
  );
}
