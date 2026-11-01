import "server-only";
import { connectDb } from "@/lib/db/connect";
import { User, privacyOf, type FriendsSee, type UserDoc } from "@/lib/db/models/User";
import { LibraryItem, WatchlistItem } from "@/lib/db/models/Library";
import { CARD_PROJECTION, titlesCol } from "@/lib/db/titles";
import { tasteCol } from "@/lib/db/taste";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { badRequest, notFound } from "@/lib/http/errors";
import { INVITE_CODE_RE } from "@/lib/social/invite";
import { PERSON_FIELDS, toPerson, userByHandle, type Person } from "@/lib/social/people";
import { blockedAround, isBlockedBetween, relationTo, relationsTo } from "@/lib/social/relations";
import { sendFriendRequest } from "@/lib/social/friends";
import { tasteMatch, tasteMatches } from "@/lib/social/taste-match";
import { SHOWN_TO_FRIENDS, dnaForOthers, visibleScopes, type Relation, type Scope } from "@/lib/social/visibility";
import type { TitleKey } from "@/lib/catalog/types";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SHELF_LIMIT = 60;

export type ProfileTitle = { card: TitleCard; rating: number | null; status: string | null; at: string };

export type ProfileView = {
  person: Person;
  relation: Relation;
  friendshipId: string | null;
  match: number | null;
  dna: string[];
  /** What this viewer may see beyond the public card. */
  scopes: Scope[];
  /** Only on your own profile: what friends are allowed to see. */
  friendsSee: FriendsSee | null;
  ratings: ProfileTitle[] | null;
  library: ProfileTitle[] | null;
  watchlist: ProfileTitle[] | null;
};

/** Titles behind DNA phrases the owner might have hidden: their names, to keep them out of what others read. */
async function hiddenTitleNames(uid: string): Promise<string[]> {
  const [lib, wl] = await Promise.all([
    LibraryItem.find({ uid, hiddenFromFriends: true }, { key: 1 }).lean(),
    WatchlistItem.find({ uid, hiddenFromFriends: true }, { key: 1 }).lean(),
  ]);
  const keys = [...lib, ...wl].map((i) => i.key as TitleKey);
  if (!keys.length) return [];
  const docs = await (await titlesCol()).find({ _id: { $in: keys } }, { projection: { title: 1 } }).toArray();
  return docs.map((d) => d.title);
}

/** Taste DNA phrases as others may read them (never the longer summary). */
export async function publicDna(uid: string): Promise<string[]> {
  const profile = await (await tasteCol()).findOne({ uid }, { projection: { tasteDNA: 1 } });
  if (!profile?.tasteDNA?.length) return [];
  return dnaForOthers(profile.tasteDNA, await hiddenTitleNames(uid));
}

async function cards(keys: string[]) {
  const docs = await (await titlesCol()).find({ _id: { $in: keys as TitleKey[] } }, { projection: CARD_PROJECTION }).toArray();
  return new Map(docs.map((d) => [d._id as string, toCard(d)]));
}

/**
 * /u/[handle]. Blocked either way, an admin-blocked account, or no such handle: all the same
 * "not found". Everyone else gets the public card; friends get what the owner allows. Your own
 * profile shows exactly what friends see, so you can check it.
 */
export async function profileFor(viewer: string, handle: string): Promise<ProfileView> {
  await connectDb();
  const owner = await userByHandle(handle);
  if (!owner || (owner._id !== viewer && (await isBlockedBetween(viewer, owner._id)))) throw notFound("No one here by that name.");
  const self = owner._id === viewer;
  const privacy = privacyOf(owner);
  const rel = await relationTo(viewer, owner._id);
  const scopes = visibleScopes(self ? "friends" : rel.relation, privacy.friendsSee);

  const [dna, match] = await Promise.all([publicDna(owner._id), self ? null : tasteMatch(viewer, owner._id)]);
  const see = (s: Scope) => scopes.includes(s);
  const [rated, library, watchlist] = await Promise.all([
    see("ratings") && !see("library")
      ? LibraryItem.find({ uid: owner._id, rating: { $ne: null }, ...SHOWN_TO_FRIENDS }, { key: 1, rating: 1, status: 1, updatedAt: 1 })
          .sort({ updatedAt: -1 })
          .limit(SHELF_LIMIT)
          .lean()
      : null,
    see("library")
      ? LibraryItem.find({ uid: owner._id, ...SHOWN_TO_FRIENDS }, { key: 1, rating: 1, status: 1, addedAt: 1 }).sort({ addedAt: -1 }).limit(SHELF_LIMIT).lean()
      : null,
    see("watchlist") ? WatchlistItem.find({ uid: owner._id, ...SHOWN_TO_FRIENDS }, { key: 1, addedAt: 1 }).sort({ addedAt: -1 }).limit(SHELF_LIMIT).lean() : null,
  ]);
  const byKey = await cards([...(rated ?? []), ...(library ?? []), ...(watchlist ?? [])].map((i) => i.key));
  const rows = (items: { key: string; rating?: number | null; status?: string | null; addedAt?: Date; updatedAt?: Date }[] | null) =>
    items?.flatMap((i) => {
      const card = byKey.get(i.key);
      return card ? [{ card, rating: i.rating ?? null, status: i.status ?? null, at: new Date(i.updatedAt ?? i.addedAt ?? Date.now()).toISOString() }] : [];
    }) ?? null;

  return {
    person: toPerson(owner),
    relation: rel.relation,
    friendshipId: rel.friendshipId,
    match,
    dna,
    scopes,
    friendsSee: self ? privacy.friendsSee : null,
    ratings: rows(rated),
    library: rows(library),
    watchlist: rows(watchlist),
  };
}

export type SearchResult = { person: Person; relation: Relation; friendshipId: string | null; match: number | null };

/**
 * "Find friends": by handle prefix or name. Never yourself, never anyone blocked either way,
 * never an admin-blocked account, and never anyone who opted out of search.
 */
export async function searchPeople(viewer: string, raw: string): Promise<SearchResult[]> {
  const q = raw.trim().replace(/^@+/, "");
  if (q.length < 2) return [];
  await connectDb();
  const hidden = await blockedAround(viewer);
  const docs = await User.find(
    {
      _id: { $nin: [viewer, ...hidden] },
      status: { $ne: "blocked" },
      "privacy.searchable": { $ne: false },
      $or: [{ handle: { $regex: `^${escapeRegex(q.toLowerCase())}` } }, { displayName: { $regex: escapeRegex(q), $options: "i" } }],
    },
    PERSON_FIELDS,
  )
    .limit(10)
    .lean<UserDoc[]>();
  const [relations, matches] = await Promise.all([relationsTo(viewer, docs.map((d) => d._id)), tasteMatches(viewer, docs.map((d) => d._id))]);
  return docs
    .map((d) => ({
      person: toPerson(d),
      relation: relations.get(d._id)?.relation ?? "none",
      friendshipId: relations.get(d._id)?.friendshipId ?? null,
      match: matches.get(d._id) ?? null,
    }))
    .sort((a, b) => Number(b.person.handle?.startsWith(q.toLowerCase())) - Number(a.person.handle?.startsWith(q.toLowerCase())));
}

// ── Invites ─────────────────────────────────────────────────────────────────

export type InviteCard = { person: Person; dna: string[] };

/** Whose invite this is (the landing page shows it to anyone, signed in or not). */
export async function inviteCard(code: string): Promise<InviteCard | null> {
  if (!INVITE_CODE_RE.test(code)) return null;
  await connectDb();
  const owner = await User.findOne({ inviteCode: code, status: { $ne: "blocked" } }, PERSON_FIELDS).lean<UserDoc>();
  if (!owner) return null;
  return { person: toPerson(owner), dna: await publicDna(owner._id) };
}

export type InviteState = InviteCard & { relation: Relation; match: number | null };

async function inviteOwner(viewer: string, code: string) {
  if (!INVITE_CODE_RE.test(code)) throw notFound("This invite link doesn’t work any more.");
  await connectDb();
  const owner = await User.findOne({ inviteCode: code, status: { $ne: "blocked" } }, PERSON_FIELDS).lean<UserDoc>();
  if (!owner || (owner._id !== viewer && (await isBlockedBetween(viewer, owner._id)))) throw notFound("This invite link doesn’t work any more.");
  return owner;
}

export async function inviteFor(viewer: string, code: string): Promise<InviteState> {
  const owner = await inviteOwner(viewer, code);
  const [rel, match, dna] = await Promise.all([relationTo(viewer, owner._id), owner._id === viewer ? null : tasteMatch(viewer, owner._id), publicDna(owner._id)]);
  return { person: toPerson(owner), dna, relation: rel.relation, match };
}

/** Opening someone's invite while signed in sends them a friend request (or accepts theirs). */
export async function acceptInvite(viewer: string, code: string): Promise<InviteState> {
  const owner = await inviteOwner(viewer, code);
  if (owner._id === viewer) throw badRequest("That’s your own invite link. Send it to a friend instead.");
  const rel = await sendFriendRequest(viewer, owner._id, "invite");
  const [match, dna] = await Promise.all([tasteMatch(viewer, owner._id), publicDna(owner._id)]);
  return { person: toPerson(owner), dna, relation: rel.relation, match };
}
