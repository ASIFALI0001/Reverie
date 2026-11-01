import "server-only";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { SharedList, type SharedListDoc } from "@/lib/db/models/Social";
import { CARD_PROJECTION, titlesCol } from "@/lib/db/titles";
import { tasteCol } from "@/lib/db/taste";
import { ensureTitle } from "@/lib/catalog/ensure";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { titleKey, type MediaType, type TitleKey } from "@/lib/catalog/types";
import { getQuickScores } from "@/lib/reco/match-engine";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { groupPickReason } from "@/lib/ai/group-pick";
import { notify } from "@/lib/social/notifications";
import { peopleByUid, type Person } from "@/lib/social/people";
import { friendUids } from "@/lib/social/relations";
import { rankForGroup } from "@/lib/social/combined-match";

/**
 * Shared watchlists ("Weekend with Priya"): the owner invites friends; every member can add and
 * remove titles; the list sorts by the combined match in lib/social/combined-match.ts, and each
 * card shows every member's own match.
 */

export const LIST_NAME_MAX = 60;
const MAX_MEMBERS = 8;
const MAX_ITEMS = 200;
const SCORED_ITEMS = 80;

export type ListSummary = { id: string; name: string; owner: boolean; members: Person[]; count: number; posters: (string | null)[]; updatedAt: string };
export type ListMember = Person & { owner: boolean };
export type ListItemView = {
  key: string;
  card: TitleCard;
  addedBy: string;
  addedAt: string;
  /** Each member's own match, in the members' order (null: no taste profile yet, or not scored). */
  matches: { uid: string; match: number | null }[];
  combined: number | null;
  lowest: number | null;
};
export type ListView = { id: string; name: string; ownerUid: string; you: string; members: ListMember[]; items: ListItemView[]; updatedAt: string };

const notThere = () => notFound("That list isn’t there any more.");

async function loadList(uid: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw notThere();
  await connectDb();
  const list = await SharedList.findById(id).lean<SharedListDoc & { _id: mongoose.Types.ObjectId; updatedAt: Date }>();
  if (!list || !list.memberUids.includes(uid)) throw notThere();
  return list;
}

async function friendsOnly(uid: string, uids: string[]) {
  const friends = new Set(await friendUids(uid));
  return [...new Set(uids)].filter((u) => u !== uid && friends.has(u));
}

export async function listsFor(uid: string): Promise<ListSummary[]> {
  await connectDb();
  const lists = await SharedList.find({ memberUids: uid }).sort({ updatedAt: -1 }).limit(50).lean<(SharedListDoc & { _id: unknown; updatedAt: Date })[]>();
  if (!lists.length) return [];
  const keys = [...new Set(lists.flatMap((l) => l.items.slice(-4).map((i) => i.key as TitleKey)))];
  const [people, titles] = await Promise.all([
    peopleByUid(lists.flatMap((l) => l.memberUids)),
    (await titlesCol()).find({ _id: { $in: keys } }, { projection: { posterPath: 1 } }).toArray(),
  ]);
  const posters = new Map(titles.map((t) => [t._id as string, t.posterPath ?? null]));
  return lists.map((l) => ({
    id: String(l._id),
    name: l.name,
    owner: l.ownerUid === uid,
    members: l.memberUids.flatMap((m) => (people.get(m) ? [people.get(m)!] : [])),
    count: l.items.length,
    posters: l.items
      .slice(-4)
      .reverse()
      .map((i) => posters.get(i.key) ?? null),
    updatedAt: new Date(l.updatedAt).toISOString(),
  }));
}

export async function createList(uid: string, name: string, memberUids: string[]) {
  const members = (await friendsOnly(uid, memberUids)).slice(0, MAX_MEMBERS - 1);
  if (!members.length) throw badRequest("Add at least one friend to share it with.");
  await connectDb();
  const list = await SharedList.create({ name: name.trim().slice(0, LIST_NAME_MAX), ownerUid: uid, memberUids: [uid, ...members], items: [] });
  for (const m of members) await notify(m, "shared_list_invite", uid, { listId: String(list._id), name: list.name });
  return { id: String(list._id) };
}

export async function getList(uid: string, id: string): Promise<ListView> {
  const list = await loadList(uid, id);
  const people = await peopleByUid(list.memberUids);
  // Members who've since left Reverie (or were blocked by an admin) drop out of the view.
  const members = list.memberUids.filter((m) => people.has(m) || m === uid);
  const keys = list.items.map((i) => i.key as TitleKey);
  const [titles, scores] = await Promise.all([
    (await titlesCol()).find({ _id: { $in: keys } }, { projection: CARD_PROJECTION }).toArray(),
    Promise.all(members.map((m) => getQuickScores(m, keys.slice(-SCORED_ITEMS)).catch(() => ({}) as Record<string, number>))),
  ]);
  const cards = new Map(titles.map((t) => [t._id as string, toCard(t)]));
  const rows = list.items.flatMap((i) => {
    const card = cards.get(i.key);
    if (!card) return [];
    const perMember = members.map((m, j) => ({ uid: m, match: scores[j]![i.key] ?? null }));
    return [{ i, card, perMember, matches: perMember.map((x) => x.match) }];
  });
  const items: ListItemView[] = rankForGroup(rows).map((r) => ({
    key: r.i.key,
    card: r.card,
    addedBy: r.i.addedBy,
    addedAt: new Date(r.i.addedAt ?? Date.now()).toISOString(),
    matches: r.perMember,
    combined: r.combined,
    lowest: r.lowest,
  }));

  const me = people.get(uid);
  return {
    id: String(list._id),
    name: list.name,
    ownerUid: list.ownerUid,
    you: uid,
    members: members.flatMap((m) => {
      const p = people.get(m) ?? (m === uid && me ? me : null);
      return p ? [{ ...p, owner: m === list.ownerUid }] : [];
    }),
    items,
    updatedAt: new Date(list.updatedAt).toISOString(),
  };
}

export async function addListItem(uid: string, id: string, mediaType: MediaType, tmdbId: number) {
  const list = await loadList(uid, id);
  const key = titleKey(mediaType, tmdbId);
  if (list.items.some((i) => i.key === key)) return { added: false };
  if (list.items.length >= MAX_ITEMS) throw badRequest(`A shared list holds up to ${MAX_ITEMS} titles.`);
  const doc = await ensureTitle(key, { enrich: false, jikan: false });
  if (!doc) throw notFound("We couldn’t find that title.");
  await SharedList.updateOne({ _id: list._id, "items.key": { $ne: key } }, { $push: { items: { key, mediaType, tmdbId, addedBy: uid, addedAt: new Date() } } });
  return { added: true };
}

export async function removeListItem(uid: string, id: string, key: string) {
  const list = await loadList(uid, id);
  await SharedList.updateOne({ _id: list._id }, { $pull: { items: { key } } });
  return { removed: true };
}

export async function renameList(uid: string, id: string, name: string) {
  const list = await loadList(uid, id);
  if (list.ownerUid !== uid) throw forbidden("Only the list’s owner can rename it.");
  await SharedList.updateOne({ _id: list._id }, { $set: { name: name.trim().slice(0, LIST_NAME_MAX) } });
  return { name: name.trim().slice(0, LIST_NAME_MAX) };
}

export async function addListMembers(uid: string, id: string, uids: string[]) {
  const list = await loadList(uid, id);
  if (list.ownerUid !== uid) throw forbidden("Only the list’s owner can add people.");
  const room = MAX_MEMBERS - list.memberUids.length;
  const fresh = (await friendsOnly(uid, uids)).filter((u) => !list.memberUids.includes(u)).slice(0, Math.max(0, room));
  if (!fresh.length) return { added: 0 };
  await SharedList.updateOne({ _id: list._id }, { $addToSet: { memberUids: { $each: fresh } } });
  for (const m of fresh) await notify(m, "shared_list_invite", uid, { listId: id, name: list.name });
  return { added: fresh.length };
}

/**
 * The owner removes someone, or anyone leaves. When the owner leaves, the list passes to the
 * next member; the last one out deletes it.
 */
export async function removeListMember(uid: string, id: string, member: string) {
  const list = await loadList(uid, id);
  if (member !== uid && list.ownerUid !== uid) throw forbidden("Only the list’s owner can remove people.");
  const rest = list.memberUids.filter((m) => m !== member);
  if (!rest.length) {
    await SharedList.deleteOne({ _id: list._id });
    return { left: true, deleted: true };
  }
  await SharedList.updateOne({ _id: list._id }, { $set: { memberUids: rest, ...(list.ownerUid === member ? { ownerUid: rest[0] } : {}) } });
  return { left: member === uid, deleted: false };
}

export async function deleteList(uid: string, id: string) {
  const list = await loadList(uid, id);
  if (list.ownerUid !== uid) throw forbidden("Only the list’s owner can delete it.");
  await SharedList.deleteOne({ _id: list._id });
  return { deleted: true };
}

export type GroupPick = { key: string; card: TitleCard; combined: number; matches: { uid: string; name: string; match: number | null }[]; reason: string; source: "ai" | "fallback" };

/** "Pick for us tonight": the best combined match, with one line on why it works for everyone. */
export async function pickForTonight(uid: string, id: string): Promise<GroupPick | null> {
  const view = await getList(uid, id);
  const best = view.items.find((i) => i.combined != null);
  if (!best) return null;
  const names = new Map(view.members.map((m) => [m.uid, m.name.split(" ")[0]!]));
  const [profiles, doc] = await Promise.all([
    (await tasteCol()).find({ uid: { $in: view.members.map((m) => m.uid) } }, { projection: { uid: 1, socialGenreAffinity: 1, genreAffinity: 1 } }).toArray(),
    (await titlesCol()).findOne({ _id: best.key as TitleKey }, { projection: { vibe: 1 } }),
  ]);
  const leans = new Map(
    profiles.map((p) => [
      p.uid,
      (p.socialGenreAffinity ?? p.genreAffinity ?? [])
        .filter((g) => g.value > 0.3)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map((g) => g.term),
    ]),
  );
  const matches = best.matches.map((m) => ({ uid: m.uid, name: names.get(m.uid) ?? "Someone", match: m.match }));
  const { reason, source } = await groupPickReason({
    title: best.card.title,
    year: best.card.year,
    genres: best.card.genres,
    vibe: (doc as { vibe?: { summary?: string } } | null)?.vibe?.summary ?? null,
    members: matches.map((m) => ({ name: m.name, match: m.match, leans: leans.get(m.uid) ?? [] })),
  });
  return { key: best.key, card: best.card, combined: best.combined!, matches, reason, source };
}
