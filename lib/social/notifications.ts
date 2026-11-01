import "server-only";
import { connectDb } from "@/lib/db/connect";
import { Friendship, Notification, type NotificationType } from "@/lib/db/models/Social";
import { blockedAround, isBlockedBetween } from "@/lib/social/relations";
import { peopleByUid, type Person } from "@/lib/social/people";

export type NotificationView = {
  id: string;
  type: NotificationType;
  actor: Person | null;
  payload: Record<string, unknown>;
  /** friend_request: whether it's still waiting, already answered, or withdrawn. */
  state?: "pending" | "accepted" | "gone";
  read: boolean;
  at: string;
};

const LIST_LIMIT = 30;

/** Tell `uid` about something. Nothing is sent between people who have blocked each other. */
export async function notify(uid: string, type: NotificationType, actorUid: string | null, payload: Record<string, unknown> = {}) {
  if (actorUid && (actorUid === uid || (await isBlockedBetween(uid, actorUid)))) return;
  await connectDb();
  await Notification.create({ uid, type, actorUid, payload });
}

/**
 * The bell's list, newest first. People are resolved now, not when the notification was written,
 * so a block, a deleted account or a new name applies to old notifications too.
 */
export async function listNotifications(uid: string): Promise<{ items: NotificationView[]; unread: number }> {
  await connectDb();
  const [docs, blocked] = await Promise.all([Notification.find({ uid }).sort({ createdAt: -1 }).limit(LIST_LIMIT * 2).lean(), blockedAround(uid)]);
  const kept = docs.filter((d) => !d.actorUid || !blocked.has(d.actorUid));
  const actors = await peopleByUid(kept.flatMap((d) => (d.actorUid ? [d.actorUid] : [])));
  const visible = kept.filter((d) => !d.actorUid || actors.has(d.actorUid)).slice(0, LIST_LIMIT);

  const requestIds = visible.flatMap((d) => (d.type === "friend_request" && typeof d.payload?.friendshipId === "string" ? [d.payload.friendshipId] : []));
  const requests = requestIds.length ? await Friendship.find({ _id: { $in: requestIds } }, { status: 1 }).lean() : [];
  const requestState = new Map(requests.map((r) => [String(r._id), r.status as "pending" | "accepted"]));

  const items = visible.map((d) => {
    const payload = (d.payload ?? {}) as Record<string, unknown>;
    return {
      id: String(d._id),
      type: d.type as NotificationType,
      actor: d.actorUid ? actors.get(d.actorUid)! : null,
      payload,
      ...(d.type === "friend_request" ? { state: requestState.get(String(payload.friendshipId)) ?? ("gone" as const) } : {}),
      read: Boolean(d.readAt),
      at: new Date(d.createdAt).toISOString(),
    };
  });
  return { items, unread: items.filter((n) => !n.read).length };
}

export async function markNotificationsRead(uid: string, ids?: string[]) {
  await connectDb();
  const filter = ids?.length ? { uid, _id: { $in: ids }, readAt: null } : { uid, readAt: null };
  const res = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return { marked: res.modifiedCount };
}
