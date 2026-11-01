import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";

import { USER_KEYED_COLLECTIONS, USER_PAIR_COLLECTIONS } from "@/lib/db/user-collections";

export { USER_KEYED_COLLECTIONS, USER_PAIR_COLLECTIONS };

/**
 * Permanently remove everything Reverie knows about a user (the Firebase account is deleted
 * separately). Admin audit logs are kept: they're the record of who looked at what.
 */
export async function deleteAllUserData(uid: string) {
  await connectDb();
  const db = mongoose.connection.db!;
  const results = await Promise.all([
    ...USER_KEYED_COLLECTIONS.map((c) => db.collection(c).deleteMany({ uid })),
    ...USER_PAIR_COLLECTIONS.map(([c, fields]) => db.collection(c).deleteMany({ $or: fields.map((f) => ({ [f]: uid })) })),
    // Notifications others got about this user.
    db.collection("notifications").deleteMany({ actorUid: uid }),
  ]);
  // Others' twin lists forget them.
  await db.collection("tasteTwins").updateMany({ "twins.twinUid": uid }, { $pull: { twins: { twinUid: uid } } } as never);
  // Shared lists: leave every list; a list they owned passes to the next member, an emptied one goes.
  const lists = db.collection<{ _id: unknown; ownerUid: string; memberUids: string[] }>("sharedLists");
  for (const list of await lists.find({ memberUids: uid }).toArray()) {
    const rest = list.memberUids.filter((m) => m !== uid);
    if (rest.length === 0) await lists.deleteOne({ _id: list._id });
    else await lists.updateOne({ _id: list._id }, { $set: { memberUids: rest, ownerUid: list.ownerUid === uid ? rest[0]! : list.ownerUid } });
  }
  await db.collection("users").deleteOne({ _id: uid as never });
  return results.reduce((n, r) => n + r.deletedCount, 0);
}

/** Forget learned taste but keep the library and watchlist. */
export async function resetTaste(uid: string) {
  await connectDb();
  const db = mongoose.connection.db!;
  await Promise.all(
    ["tasteProfiles", "matchCache", "homeCache"].map((c) => db.collection(c).deleteMany({ uid })),
  );
}
