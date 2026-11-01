"use client";

import Link from "next/link";
import { FaceStack } from "@/components/social/FaceStack";
import type { FriendsOnTitle as Friends } from "@/lib/social/friends-on-title";

/**
 * "3 friends watched this · Rahul (82% match) rated it 9/10", with their faces, and a quiet note
 * when their ratings moved your match. Only friends who share that much ever appear here.
 */
export function FriendsOnTitle({ data, kind }: { data: Friends | null | undefined; kind: "film" | "show" }) {
  if (!data?.count) return null;
  const lead = data.friends.find((f) => f.rating != null) ?? data.friends[0]!;
  const first = lead.person.name.split(" ")[0];
  const leadLine =
    lead.rating != null ? `${first}${lead.tasteMatch != null ? ` (${lead.tasteMatch}% match)` : ""} rated it ${lead.rating}/10` : `${first} ${lead.status === "watching" ? "is watching it" : "watched it"}`;
  const delta = data.boost ? data.boost.to - data.boost.from : 0;

  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-5">
      <FaceStack people={data.friends.map((f) => f.person)} />
      <p className="text-[0.9375rem]">
        <span className="text-text">
          {data.count === 1 ? "A friend" : `${data.count} friends`} watched this {kind}
        </span>
        <span className="text-muted"> · </span>
        {lead.person.handle ? (
          <Link href={`/u/${lead.person.handle}`} className="link-draw text-text">
            {leadLine}
          </Link>
        ) : (
          <span className="text-text">{leadLine}</span>
        )}
      </p>
      {delta !== 0 ? (
        <p className="w-full text-meta text-muted">
          Their ratings {delta > 0 ? "nudged your match up" : "nudged your match down"} {Math.abs(delta)} point{Math.abs(delta) === 1 ? "" : "s"}.
        </p>
      ) : null}
    </div>
  );
}
