import "server-only";
import { connectDb } from "@/lib/db/connect";
import { Friendship, UserBlock, pairOf } from "@/lib/db/models/Social";
import type { Relation } from "@/lib/social/visibility";

/** Who stands where with whom: friendships, pending requests, and blocks between users. */

export type RelationState = { relation: Relation; friendshipId: string | null };

/** Everyone `uid` blocked or was blocked by: to each other, they don't exist. */
export async function blockedAround(uid: string): Promise<Set<string>> {
  await connectDb();
  const rows = await UserBlock.find({ $or: [{ blocker: uid }, { blocked: uid }] }, { blocker: 1, blocked: 1 }).lean();
  return new Set(rows.map((r) => (r.blocker === uid ? r.blocked : r.blocker)));
}

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  await connectDb();
  return Boolean(await UserBlock.exists({ $or: [{ blocker: a, blocked: b }, { blocker: b, blocked: a }] }));
}

export async function relationsTo(viewer: string, others: string[]): Promise<Map<string, RelationState>> {
  await connectDb();
  const out = new Map<string, RelationState>();
  const rest = [...new Set(others)].filter((o) => {
    if (o === viewer) out.set(o, { relation: "self", friendshipId: null });
    return o !== viewer;
  });
  if (!rest.length) return out;
  const docs = await Friendship.find({ $or: rest.map((o) => pairOf(viewer, o)) }).lean();
  const byOther = new Map(docs.map((d) => [d.userA === viewer ? d.userB : d.userA, d]));
  for (const o of rest) {
    const d = byOther.get(o);
    const relation: Relation = !d ? "none" : d.status === "accepted" ? "friends" : d.requestedBy === viewer ? "request-sent" : "request-received";
    out.set(o, { relation, friendshipId: d ? String(d._id) : null });
  }
  return out;
}

export async function relationTo(viewer: string, other: string): Promise<RelationState> {
  return (await relationsTo(viewer, [other])).get(other)!;
}

export async function friendUids(uid: string): Promise<string[]> {
  await connectDb();
  const docs = await Friendship.find({ status: "accepted", $or: [{ userA: uid }, { userB: uid }] }, { userA: 1, userB: 1 }).lean();
  return docs.map((d) => (d.userA === uid ? d.userB : d.userA));
}
