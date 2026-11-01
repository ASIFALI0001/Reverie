import "server-only";
import { connectDb } from "@/lib/db/connect";
import { User, type UserDoc } from "@/lib/db/models/User";

/** How one person appears to another: never their email, and only their photo if they chose it. */
export type Person = {
  uid: string;
  name: string;
  handle: string | null;
  photoURL: string | null;
  avatar: { kind: "photo" | "monogram"; tint: string };
};

export const PERSON_FIELDS = { displayName: 1, handle: 1, photoURL: 1, avatar: 1, status: 1, privacy: 1 } as const;

type PersonSource = Pick<UserDoc, "_id" | "displayName" | "handle" | "photoURL" | "avatar">;

export function toPerson(d: PersonSource): Person {
  const kind = (d.avatar?.kind ?? "monogram") as "photo" | "monogram";
  return {
    uid: d._id,
    name: d.displayName?.trim() || (d.handle ? `@${d.handle}` : "Reverie viewer"),
    handle: d.handle ?? null,
    photoURL: kind === "photo" ? (d.photoURL ?? null) : null,
    avatar: { kind, tint: d.avatar?.tint ?? "tungsten" },
  };
}

/** People by uid. Accounts an admin blocked, and deleted ones, don't come back: to others they're gone. */
export async function peopleByUid(uids: string[]): Promise<Map<string, Person>> {
  if (!uids.length) return new Map();
  await connectDb();
  const docs = await User.find({ _id: { $in: [...new Set(uids)] }, status: { $ne: "blocked" } }, PERSON_FIELDS).lean<UserDoc[]>();
  return new Map(docs.map((d) => [d._id, toPerson(d)]));
}

/** An active account by @handle (case-insensitive input), with its privacy settings. */
export async function userByHandle(handle: string) {
  await connectDb();
  return User.findOne({ handle: handle.trim().replace(/^@+/, "").toLowerCase(), status: { $ne: "blocked" } }, { ...PERSON_FIELDS, inviteCode: 1 }).lean<UserDoc>();
}
