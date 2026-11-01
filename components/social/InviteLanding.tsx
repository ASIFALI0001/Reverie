"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { animate, motion, useReducedMotion } from "motion/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AvatarsSnap } from "@/components/social/AvatarsSnap";
import { InvitePanel } from "@/components/social/InvitePanel";
import { RelationActions } from "@/components/social/RelationActions";
import { useMe } from "@/lib/api/me";
import { useAcceptInvite, useInvite } from "@/lib/api/social";
import { forgetInvite, rememberInvite } from "@/lib/social/pending-invite";
import { ease } from "@/lib/motion";
import type { InviteCard } from "@/lib/social/profile";

/**
 * /invite/[code]. Signed out: who's inviting you and why Reverie, then sign-up (the invite waits
 * through onboarding). Signed in: the reveal — your avatars snap together and the taste match
 * counts up — with the friend request sent for you if you came here through sign-up.
 */
export function InviteLanding({
  code,
  card,
}: {
  code: string;
  card: InviteCard;
}) {
  const { status } = useAuth();
  if (status === "loading") return <LandingSkeleton />;
  return status === "signed-in" ? (
    <SignedIn code={code} card={card} />
  ) : (
    <SignedOut code={code} card={card} />
  );
}

/** Two columns on wide screens: the person on the left, what happens next on the right. */
function Spread({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
      {left}
      {right}
    </div>
  );
}

function DnaList({ card, label }: { card: InviteCard; label: string }) {
  const reduced = useReducedMotion();
  if (!card.dna.length) return null;
  return (
    <div>
      <p className="caption">{label}</p>
      <ul className="mt-3 border-t border-hairline">
        {card.dna.slice(0, 3).map((phrase, i) => (
          <li
            key={phrase}
            className="overflow-hidden border-b border-hairline py-2.5"
          >
            <motion.span
              className="block font-display text-[clamp(1.5rem,2.8vw,2.125rem)] leading-[1.1]"
              initial={reduced ? false : { y: "105%" }}
              animate={{ y: 0 }}
              transition={{
                duration: 0.85,
                ease: ease.out,
                delay: 0.3 + i * 0.1,
              }}
            >
              {phrase}
            </motion.span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  [
    "Join and take the taste quiz",
    "Two minutes of picking what you love. No typing.",
  ],
  [
    "See your taste match",
    "How close your tastes are, and where you both agree.",
  ],
  [
    "Watch together",
    "Send each other films worth the evening, and pick for movie night.",
  ],
] as const;

function SignedOut({ code, card }: { code: string; card: InviteCard }) {
  const reduced = useReducedMotion();
  const next = encodeURIComponent(`/invite/${code}?joined=1`);
  const first = card.person.name.split(" ")[0];
  return (
    <Spread
      left={
        <div>
          <motion.span
            className="inline-block"
            initial={reduced ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: ease.out }}
          >
            <Avatar
              name={card.person.name}
              photoURL={card.person.photoURL}
              avatar={card.person.avatar}
              size={84}
            />
          </motion.span>
          <h1 className="mt-8 max-w-[16ch] text-h1">
            {first} invited you to Reverie.
          </h1>
          <div className="mt-10 max-w-2xl">
            <DnaList card={card} label={`${first}’s Taste DNA`} />
          </div>
        </div>
      }
      right={
        <div className="lg:pb-2">
          <p className="max-w-[44ch] text-[1.0625rem] text-muted">
            Reverie learns what you love and tells you how much you’ll like any
            film or series before you press play.
          </p>
          <ol className="mt-8 border-t border-hairline">
            {STEPS.map(([title, body], i) => (
              <li
                key={title}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-hairline py-4"
              >
                <span className="numeral pt-0.5 text-[0.875rem] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-[1.0625rem]">
                    {i === 1 ? `See your taste match with ${first}` : title}
                  </span>
                  <span className="mt-0.5 block text-meta text-muted">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link
                href={`/signup?next=${next}`}
                onClick={() => rememberInvite(code)}
              >
                Join Reverie
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link
                href={`/signin?next=${next}`}
                onClick={() => rememberInvite(code)}
              >
                I have an account
              </Link>
            </Button>
          </div>
        </div>
      }
    />
  );
}

function SignedIn({ code, card }: { code: string; card: InviteCard }) {
  const joined = useSearchParams().get("joined") === "1";
  const invite = useInvite(code);
  const accept = useAcceptInvite(code);
  const { data: me } = useMe();
  const sent = useRef(false);

  // Arriving from sign-up or sign-in: send the request for them, once.
  const relation = invite.data?.relation;
  useEffect(() => {
    if (!joined || relation !== "none" || sent.current) return;
    sent.current = true;
    accept.mutate();
  }, [joined, relation, accept]);
  useEffect(() => {
    if (relation && relation !== "none") forgetInvite();
  }, [relation]);

  if (invite.isError) {
    return (
      <div>
        <p className="font-display text-h2">
          This invite link doesn’t work any more.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    );
  }
  const state = accept.data ?? invite.data;
  if (!state || (joined && state.relation === "none" && !accept.isError))
    return <LandingSkeleton />;

  const first = card.person.name.split(" ")[0];
  if (state.relation === "self") {
    return (
      <div>
        <h1 className="max-w-[16ch] text-h1">This is your own invite link.</h1>
        <p className="mt-6 max-w-[46ch] text-muted">
          Send it to a friend: when they open it, you’ll get a friend request
          and both see how your tastes match.
        </p>
        <InvitePanel className="mt-10 max-w-2xl" />
      </div>
    );
  }

  const myFace = {
    name: me?.displayName ?? "You",
    photoURL: me?.photoURL ?? null,
    avatar: me?.avatar ?? null,
  };
  const line =
    state.relation === "friends"
      ? `You and ${first} are friends.`
      : state.relation === "request-sent"
        ? `Request sent. ${first} will see it in their notifications.`
        : state.relation === "request-received"
          ? `${first} already asked to be friends.`
          : `Send ${first} a friend request to connect.`;

  return (
    <Spread
      right={<DnaList card={card} label={`${first}’s Taste DNA`} />}
      left={
        <div>
          <AvatarsSnap a={myFace} b={card.person} size={84} delay={0.15} />
          {state.match != null ? (
            <h1 className="mt-10 max-w-[18ch] text-h1">
              <span className="sr-only">
                You and {first} are {state.match}% taste match.
              </span>
              <span aria-hidden="true">
                You and {first} are <MatchCount value={state.match} />% taste
                match.
              </span>
            </h1>
          ) : (
            <h1 className="mt-10 max-w-[18ch] text-h1">
              You and {first}, on Reverie.
            </h1>
          )}
          <p className="mt-6 max-w-[46ch] text-[1.0625rem] text-muted">
            {line}
          </p>
          {state.match == null ? (
            <p className="mt-3 max-w-[46ch] text-meta text-muted">
              Your taste match appears once Reverie knows a little about what
              you like.{" "}
              <Link href="/onboarding" className="link-draw text-text">
                Take the taste quiz
              </Link>
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <RelationActions
              person={state.person}
              relation={state.relation}
              friendshipId={null}
              via="search"
              size="md"
            />
            {state.relation === "none" ? null : (
              <Button asChild variant="ghost">
                <Link
                  href={
                    card.person.handle ? `/u/${card.person.handle}` : "/friends"
                  }
                >
                  See {first}’s profile
                </Link>
              </Button>
            )}
          </div>
          {accept.isError ? (
            <p className="mt-4 text-meta text-danger">
              {accept.error instanceof Error
                ? accept.error.message
                : "That didn’t go through."}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

/** The match counts up from zero (or simply appears under reduced motion). */
function MatchCount({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, value, {
      duration: 1.4,
      delay: 0.55,
      ease: ease.out,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced]);
  return (
    <span className="text-accent tabular-nums">{reduced ? value : shown}</span>
  );
}

function LandingSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="size-[84px] rounded-full" />
      <Skeleton className="mt-8 h-24 w-full max-w-xl" />
      <Skeleton className="mt-8 h-12 w-64" />
    </div>
  );
}
