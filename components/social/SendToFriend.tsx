"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, PaperPlaneTilt, Plus } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAddToList, useFriends, useSendRecommendation, useSharedLists } from "@/lib/api/social";
import { tmdbImg } from "@/lib/images/tmdb";
import { toast } from "@/lib/store/toast";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { MediaType } from "@/lib/catalog/types";

const NOTE_MAX = 280;

type Title = { mediaType: MediaType; tmdbId: number; title: string; posterPath: string | null };

/** Names as a sentence: "Ben", "Ben and Cleo", "Ben, Cleo and Dev". */
function names(list: string[]) {
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * "Send to a friend": pick friends, add a line if you like, send. The poster folds away and
 * flies off as a paper plane (a plain confirmation under reduced motion). Shared lists sit
 * underneath, one tap to add the title to one.
 */
export function SendToFriendSheet({ open, onOpenChange, title }: { open: boolean; onOpenChange: (o: boolean) => void; title: Title }) {
  const friends = useFriends();
  const lists = useSharedLists(open);
  const send = useSendRecommendation();
  const addToList = useAddToList();
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<"pick" | "flying" | "sent">("pick");
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  function reset() {
    setPicked([]);
    setNote("");
    setPhase("pick");
    setSentTo([]);
    setAdded([]);
  }

  const all = friends.data?.friends ?? [];
  const nameOf = (uid: string) => all.find((f) => f.person.uid === uid)?.person.name.split(" ")[0] ?? "a friend";

  function submit() {
    send.mutate(
      { mediaType: title.mediaType, tmdbId: title.tmdbId, to: picked, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setSentTo(picked.map(nameOf));
          setPhase(reduced ? "sent" : "flying");
          window.setTimeout(() => setPhase("sent"), reduced ? 0 : 950);
          window.setTimeout(() => onOpenChange(false), reduced ? 1600 : 2600);
        },
        onError: (err) => toast({ title: "Couldn’t send that", description: err instanceof Error ? err.message : undefined, tone: "error" }),
      },
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) window.setTimeout(reset, 300);
      }}
      title="Send to a friend"
      description="They’ll see it with your note, and their own match for it."
    >
      <div className="mt-6 flex items-center gap-4">
        <div className="relative h-[5.25rem] w-14 shrink-0">
          <AnimatePresence>
            {phase === "pick" ? (
              <motion.span
                key="poster"
                className="absolute inset-0 overflow-hidden rounded-[2px] bg-surface"
                exit={{ scaleX: 0.15, rotate: -18, opacity: 0, transition: { duration: 0.28, ease: ease.inOut } }}
              >
                {title.posterPath ? <Image src={tmdbImg(title.posterPath, "thumb")!} alt="" fill sizes="56px" className="object-cover" /> : null}
              </motion.span>
            ) : null}
          </AnimatePresence>
          {phase === "flying" ? (
            <motion.span
              aria-hidden="true"
              className="absolute left-3 top-6 text-accent"
              initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }}
              animate={{ x: [0, 40, 160, 340], y: [0, -24, -110, -260], rotate: [0, -8, -18, -26], opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.8] }}
              transition={{ duration: 0.9, delay: 0.2, ease: ease.out, times: [0, 0.2, 0.6, 1] }}
            >
              <PaperPlaneTilt size={30} weight="fill" />
            </motion.span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-h4">{title.title}</p>
          <p role="status" className="mt-1 text-meta text-muted">
            {phase === "sent" ? `Sent to ${names(sentTo)}.` : phase === "flying" ? "Sending…" : picked.length ? `To ${names(picked.map(nameOf))}` : "Pick who it’s for"}
          </p>
        </div>
      </div>

      {phase === "sent" ? (
        <motion.p
          className="mt-8 flex items-center gap-3 text-[1.0625rem]"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.out }}
        >
          <Check size={20} weight="bold" className="text-accent" aria-hidden="true" /> On its way. You’ll hear what they think.
        </motion.p>
      ) : friends.isPending ? (
        <div aria-hidden="true" className="mt-6 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !all.length ? (
        <div className="mt-8 border-t border-hairline pt-5">
          <p className="text-text">No friends yet.</p>
          <p className="mt-1 text-meta text-muted">Invite someone, and you can send each other films worth the evening.</p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/friends">Find or invite friends</Link>
          </Button>
        </div>
      ) : (
        <form
          className={cn("mt-6 transition-opacity duration-300", phase === "flying" && "pointer-events-none opacity-50")}
          onSubmit={(e) => {
            e.preventDefault();
            if (picked.length && !send.isPending) submit();
          }}
        >
          <fieldset>
            <legend className="text-meta text-muted">Friends</legend>
            <ul data-lenis-prevent className="mt-2 max-h-[min(15rem,40vh)] overflow-y-auto border-t border-hairline">
              {all.map((f) => {
                const on = picked.includes(f.person.uid);
                return (
                  <li key={f.person.uid} className="border-b border-hairline">
                    <label className="flex cursor-pointer items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, f.person.uid] : cur.filter((u) => u !== f.person.uid)))}
                        className="size-4 shrink-0 accent-[var(--color-accent)]"
                      />
                      <Avatar name={f.person.name} photoURL={f.person.photoURL} avatar={f.person.avatar} size={32} />
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{f.person.name}</span>
                      {f.match != null ? <span className="numeral shrink-0 text-meta text-muted">{f.match}% taste match</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <label htmlFor="send-note" className="mt-6 block text-meta text-muted">
            A line for them (optional)
          </label>
          <textarea
            id="send-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            rows={2}
            placeholder="You’d love the last twenty minutes."
            className="mt-1.5 block w-full resize-none rounded-none border-0 border-b border-hairline-strong bg-transparent py-2 text-text outline-none placeholder:text-faint focus-visible:border-[var(--tint)]"
          />
          <p className="mt-1 text-right text-meta text-muted tabular-nums">
            {note.length}/{NOTE_MAX}
          </p>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={!picked.length} pending={send.isPending}>
              <PaperPlaneTilt size={18} weight="light" aria-hidden="true" /> {picked.length > 1 ? `Send to ${picked.length} friends` : "Send"}
            </Button>
          </div>
        </form>
      )}

      {phase === "pick" && lists.data?.lists.length ? (
        <div className="mt-8 border-t border-hairline pt-5">
          <p className="text-meta text-muted">Or add it to a shared list</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lists.data.lists.map((l) => {
              const done = added.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={done || addToList.isPending}
                  onClick={() =>
                    addToList.mutate(
                      { id: l.id, mediaType: title.mediaType, tmdbId: title.tmdbId },
                      {
                        onSuccess: (r) => {
                          setAdded((a) => [...a, l.id]);
                          toast({ title: r.added ? `Added to ${l.name}` : `Already on ${l.name}` });
                        },
                        onError: (err) => toast({ title: "Couldn’t add it", description: err instanceof Error ? err.message : undefined, tone: "error" }),
                      },
                    )
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[0.875rem] transition-colors duration-200",
                    done ? "border-text/40 text-text" : "border-hairline-strong text-muted hover:border-text/40 hover:text-text",
                  )}
                >
                  {done ? <Check size={14} weight="bold" aria-hidden="true" /> : <Plus size={14} weight="light" aria-hidden="true" />}
                  {l.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
