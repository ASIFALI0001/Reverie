"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MatchDialEmpty, MatchRing } from "@/components/title/MatchRing";
import { DeferredLink } from "@/components/ui/DeferredLink";
import { useMatch, useQuickScores } from "@/lib/api/match";
import { titleKey, type MediaType } from "@/lib/catalog/types";

const dial = "w-[min(10rem,42vw)] md:w-[clamp(13rem,25vw,22.5rem)]";

/**
 * The hero's focal point: the viewer's own match. The quick estimate shows
 * straight away and the dial glides to the full judgement when it lands.
 */
export function TitleMatch({ mediaType, tmdbId, path }: { mediaType: MediaType; tmdbId: number; path: string }) {
  const { status } = useAuth();
  const key = titleKey(mediaType, tmdbId);
  const match = useMatch(mediaType, tmdbId);
  // Only worth a request while the full match is still on its way.
  const quick = useQuickScores([key], match.isPending);

  if (status === "signed-out") {
    return (
      <MatchDialEmpty
        className={dial}
        note={
          <DeferredLink href={`/signin?next=${encodeURIComponent(path)}`} className="link-draw text-text">
            Sign in to see your match
          </DeferredLink>
        }
      />
    );
  }

  const data = match.data;
  if (data?.status === "no-profile") {
    return (
      <MatchDialEmpty
        className={dial}
        note={
          <Link href="/onboarding" className="link-draw text-text">
            Tell Reverie what you love
          </Link>
        }
      />
    );
  }
  if (data?.status === "ok") {
    const note = data.learning
      ? "Getting to know you"
      : data.becauseYouLiked.length
        ? `Because you liked ${data.becauseYouLiked
            .slice(0, 2)
            .map((b) => b.title)
            .join(" and ")}`
        : undefined;
    return <MatchRing value={data.score} note={note} delay={0.6} className={dial} />;
  }

  const estimate = quick.data?.[key];
  if (match.isError) {
    return estimate != null ? (
      <MatchRing value={estimate} note="A quick estimate" delay={0.6} className={dial} />
    ) : (
      <MatchDialEmpty className={dial} note="Your match isn’t available right now" />
    );
  }
  if (estimate != null) return <MatchRing value={estimate} note="Refining your match…" delay={0.6} className={dial} />;
  return <MatchDialEmpty className={dial} loading />;
}
