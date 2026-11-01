import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Friendship, Notification, SharedList, UserBlock, pairOf } from "@/lib/db/models/Social";
import { badRequest, notFound } from "@/lib/http/errors";
import { notify } from "@/lib/social/notifications";
import { peopleByUid, type Person } from "@/lib/social/people";
import { blockedAround, isBlockedBetween, relationTo, type RelationState } from "@/lib/social/relations";
import { tasteMatches } from "@/lib/social/taste-match";

export type Via = "invite" | "search" | "profile" | "twins";

/** Same message whether they blocked you, you blocked them, or they don't exist: nothing to learn from it. */
const unavailable = () => notFound("That person isn’t available.");
const isDuplicate = (err: unknown) => (err as { code?: number })?.code === 11000;

async function requireActive(uid: string) {
  await connectDb();
  if (!(await User.exists({ _id: uid, status: { $ne: "blocked" } }))) throw unavailable();
}

/**
 * Ask to be friends. If they had already asked you, this accepts instead (mutual = friends).
 * Repeating a request is harmless. Blocked either way: refused, without saying why.
 */
export async function sendFriendRequest(from: string, to: string, via: Via = "search"): Promise<RelationState> {
  if (from === to) throw badRequest("That’s you.");
  await requireActive(to);
  if (await isBlockedBetween(from, to)) throw unavailable();

  const current = await relationTo(from, to);
  if (current.relation === "friends" || current.relation === "request-sent") return current;
  if (current.relation === "request-received") return respondToRequest(from, current.friendshipId!, "accept");

  try {
    const doc = await Friendship.create({ ...pairOf(from, to), status: "pending", requestedBy: from, via });
    await notify(to, "friend_request", from, { friendshipId: String(doc._id) });
    return { relation: "request-sent", friendshipId: String(doc._id) };
  } catch (err) {
    // Two requests crossed: whichever landed first stands.
    if (isDuplicate(err)) return relationTo(from, to);
    throw err;
  }
}

/** Accept or decline a request someone sent you. */
export async function respondToRequest(uid: string, friendshipId: string, action: "accept" | "decline"): Promise<RelationState> {
  if (!mongoose.isValidObjectId(friendshipId)) throw notFound("That request isn’t there any more.");
  await connectDb();
  const doc = await Friendship.findById(friendshipId).lean();
  if (!doc || (doc.userA !== uid && doc.userB !== uid) || doc.requestedBy === uid) throw notFound("That request isn’t there any more.");
  const other = doc.userA === uid ? doc.userB : doc.userA;
  if (doc.status === "accepted") return { relation: "friends", friendshipId };
  if (action === "decline") {
    await Friendship.deleteOne({ _id: friendshipId, status: "pending" });
    return { relation: "none", friendshipId: null };
  }
  if (await isBlockedBetween(uid, other)) throw unavailable();
  const res = await Friendship.updateOne({ _id: friendshipId, status: "pending" }, { $set: { status: "accepted", acceptedAt: new Date() } });
  if (res.modifiedCount) await notify(other, "friend_accepted", uid, { friendshipId });
  return { relation: "friends", friendshipId };
}

/** Unfriend, cancel a request you sent, or turn down one you got: either way the pair is cleared. */
export async function removeFriendship(uid: string, other: string) {
  await connectDb();
  const res = await Friendship.deleteOne(pairOf(uid, other));
  return { removed: res.deletedCount > 0 };
}

/**
 * Block someone: any friendship or request between you ends, the requests they sent you leave
 * your bell, and from now on neither of you can find, see or request the other.
 */
export async function blockPerson(uid: string, other: string) {
  if (uid === other) throw badRequest("You can’t block yourself.");
  await connectDb();
  if (!(await User.exists({ _id: other }))) throw unavailable();
  try {
    await UserBlock.create({ blocker: uid, blocked: other });
  } catch (err) {
    if (!isDuplicate(err)) throw err;
  }
  await Promise.all([
    Friendship.deleteOne(pairOf(uid, other)),
    Notification.deleteMany({ uid, actorUid: other }),
    // Shared lists you're both on: they come off the ones you own…
    SharedList.updateMany({ ownerUid: uid, memberUids: other }, { $pull: { memberUids: other } }),
  ]);
  // …and you leave anyone else's (the owner keeps their list).
  await SharedList.updateMany({ ownerUid: { $ne: uid }, memberUids: { $all: [uid, other] } }, { $pull: { memberUids: uid } });
  return { blocked: true };
}

export async function unblockPerson(uid: string, other: string) {
  await connectDb();
  await UserBlock.deleteOne({ blocker: uid, blocked: other });
  return { blocked: false };
}

export type FriendRow = { person: Person; match: number | null; since: string };
export type RequestRow = { id: string; person: Person; match: number | null; at: string };
export type FriendsOverview = {
  friends: FriendRow[];
  requestsIn: RequestRow[];
  requestsOut: RequestRow[];
  /** People you blocked (not people who blocked you: that stays invisible). */
  blocked: { person: Person; at: string }[];
};

export async function friendsOverview(uid: string): Promise<FriendsOverview> {
  await connectDb();
  const [docs, myBlocks, around] = await Promise.all([
    Friendship.find({ $or: [{ userA: uid }, { userB: uid }] }).lean(),
    UserBlock.find({ blocker: uid }).sort({ createdAt: -1 }).lean(),
    blockedAround(uid),
  ]);
  const other = (d: { userA: string; userB: string }) => (d.userA === uid ? d.userB : d.userA);
  const live = docs.filter((d) => !around.has(other(d)));
  const [people, matches] = await Promise.all([
    peopleByUid([...live.map(other), ...myBlocks.map((b) => b.blocked)]),
    tasteMatches(uid, live.map(other)),
  ]);
  const row = (d: (typeof live)[number]) => {
    const person = people.get(other(d));
    return person ? { person, match: matches.get(person.uid) ?? null } : null;
  };
  const iso = (d: Date | null | undefined) => new Date(d ?? Date.now()).toISOString();

  const friends = live
    .filter((d) => d.status === "accepted")
    .flatMap((d) => {
      const r = row(d);
      return r ? [{ ...r, since: iso(d.acceptedAt ?? d.createdAt) }] : [];
    })
    .sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || a.person.name.localeCompare(b.person.name));
  const pending = (mine: boolean) =>
    live
      .filter((d) => d.status === "pending" && (d.requestedBy === uid) === mine)
      .flatMap((d) => {
        const r = row(d);
        return r ? [{ id: String(d._id), ...r, at: iso(d.createdAt) }] : [];
      })
      .sort((a, b) => b.at.localeCompare(a.at));

  return {
    friends,
    requestsIn: pending(false),
    requestsOut: pending(true),
    blocked: myBlocks.flatMap((b) => {
      const person = people.get(b.blocked);
      return person ? [{ person, at: iso(b.createdAt) }] : [];
    }),
  };
}

