import "server-only";
import mongoose from "mongoose";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { connectDb } from "@/lib/db/connect";
import { User, privacyOf } from "@/lib/db/models/User";
import { LibraryItem, WatchlistItem } from "@/lib/db/models/Library";
import { Activity, Friendship, Recommendation, SharedList, UserBlock } from "@/lib/db/models/Social";
import { AdminAuditLog } from "@/lib/db/models/Admin";
import { MoodSession, TasteSnapshot } from "@/lib/db/models/Insights";
import { CARD_PROJECTION, titlesCol } from "@/lib/db/titles";
import { tasteCol } from "@/lib/db/taste";
import { toCard } from "@/lib/catalog/cards";
import { getLibraryEntries, getWatchlist, libraryOverview } from "@/lib/library/service";
import { toTasteView } from "@/lib/reco/taste";
import { DAILY_BUDGET, dayStamp } from "@/lib/sources/quota";
import { usageDay } from "@/lib/ai/usage";
import { notFound } from "@/lib/http/errors";
import { auditActionFilter } from "@/lib/admin/format";
import type { TitleKey } from "@/lib/catalog/types";
import type {
  AdminStats,
  AdminUserActivity,
  AdminUserFriends,
  AdminUserProfile,
  AdminUserRow,
  AdminUserTaste,
  AuditPage,
  UserListQuery,
  UsersPage,
} from "@/lib/admin/types";

/**
 * Everything the admin panel reads. Admins see private data, so every per-user read here
 * is called from an /api/admin route that writes to the audit log first.
 */

const DAY_MS = 86_400_000;
export const USERS_PAGE_SIZE = 25;
export const AUDIT_PAGE_SIZE = 40;

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Display names and handles for a set of uids (blocked or deleted users still resolve to something). */
async function people(uids: string[]) {
  const docs = await User.find({ _id: { $in: [...new Set(uids)] } }, { displayName: 1, handle: 1, email: 1, photoURL: 1, avatar: 1, status: 1 }).lean();
  const byId = new Map(docs.map((d) => [d._id, d]));
  return (uid: string) => {
    const d = byId.get(uid);
    return {
      uid,
      name: d?.displayName ?? d?.email ?? (d ? "Unnamed" : "Deleted account"),
      handle: d?.handle ?? null,
      photoURL: d?.photoURL ?? null,
      avatar: d?.avatar ? { kind: (d.avatar.kind ?? "monogram") as "photo" | "monogram", tint: d.avatar.tint ?? "tungsten" } : null,
      blocked: d?.status === "blocked",
    };
  };
}

async function titleNames(keys: string[]) {
  if (!keys.length) return (k: string) => ({ key: k, title: k, posterPath: null as string | null });
  const titles = await titlesCol();
  const docs = await titles.find({ _id: { $in: [...new Set(keys)] as TitleKey[] } }, { projection: { title: 1, posterPath: 1 } }).toArray();
  const byKey = new Map(docs.map((d) => [d._id as string, d]));
  return (k: string) => ({ key: k, title: byKey.get(k)?.title ?? k, posterPath: byKey.get(k)?.posterPath ?? null });
}

// ── Overview ────────────────────────────────────────────────────────────────

export async function adminStats(now = new Date()): Promise<AdminStats> {
  await connectDb();
  const today = startOfUtcDay(now);
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const signupStart = new Date(today.getTime() - 29 * DAY_MS);
  const db = mongoose.connection.db!;

  const [total, blocked, newToday, new7d, new30d, active7d, items, watchlist, signupRows, topRows, genreRows, quotaDocs, aiDocs] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: "blocked" }),
    User.countDocuments({ createdAt: { $gte: today } }),
    User.countDocuments({ createdAt: { $gte: since(7) } }),
    User.countDocuments({ createdAt: { $gte: since(30) } }),
    User.countDocuments({ lastActiveAt: { $gte: since(7) } }),
    LibraryItem.estimatedDocumentCount(),
    WatchlistItem.estimatedDocumentCount(),
    User.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: signupStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    LibraryItem.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$key", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    LibraryItem.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$key", count: { $sum: 1 } } },
      { $lookup: { from: "titles", localField: "_id", foreignField: "_id", as: "t", pipeline: [{ $project: { genres: 1 } }] } },
      { $unwind: "$t" },
      { $unwind: "$t.genres" },
      { $group: { _id: "$t.genres", count: { $sum: "$count" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    db.collection<{ _id: string; units: number }>("quotaLedger").find({ _id: { $in: [`youtube:${dayStamp()}`, `omdb:${dayStamp()}`] } }).toArray(),
    db.collection<{ _id: string; count: number }>("usageLedger").find({ _id: { $regex: `^ai:[a-z]+:${usageDay(now)}$` } }).toArray(),
  ]);

  const perDay = new Map(signupRows.map((r) => [r._id, r.count]));
  const signups = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(signupStart.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { day, count: perDay.get(day) ?? 0 };
  });

  const titles = await titlesCol();
  const topDocs = await titles.find({ _id: { $in: topRows.map((r) => r._id) as TitleKey[] } }, { projection: CARD_PROJECTION }).toArray();
  const byKey = new Map(topDocs.map((d) => [d._id as string, d]));
  const topTitles = topRows.flatMap((r) => {
    const d = byKey.get(r._id);
    return d ? [{ card: toCard(d), count: r.count }] : [];
  });

  const quota = new Map(quotaDocs.map((d) => [d._id.split(":")[0]!, d.units]));
  const ai = new Map(aiDocs.map((d) => [d._id.split(":")[1]!, d.count]));
  const usage = [
    { label: "Gemini answers", used: ai.get("gemini") ?? 0, budget: null },
    { label: "Groq answers (fallback)", used: ai.get("groq") ?? 0, budget: null },
    { label: "OpenRouter answers (fallback)", used: ai.get("openrouter") ?? 0, budget: null },
    { label: "YouTube quota units", used: quota.get("youtube") ?? 0, budget: DAILY_BUDGET.youtube },
    { label: "OMDb requests", used: quota.get("omdb") ?? 0, budget: DAILY_BUDGET.omdb },
  ];

  return {
    users: { total, newToday, new7d, new30d, active7d, blocked },
    library: { items, watchlist },
    signups,
    topTitles,
    topGenres: genreRows.map((g) => ({ genre: g._id, count: g.count })),
    usage,
    generatedAt: now.toISOString(),
  };
}

// ── Users table ─────────────────────────────────────────────────────────────

const SORTS: Record<NonNullable<UserListQuery["sort"]>, Record<string, 1 | -1>> = {
  joined: { createdAt: 1 },
  "-joined": { createdAt: -1 },
  active: { lastActiveAt: 1 },
  "-active": { lastActiveAt: -1 },
  name: { displayName: 1 },
  "-name": { displayName: -1 },
};

export async function listUsers(q: UserListQuery): Promise<UsersPage> {
  await connectDb();
  const filter: Record<string, unknown> = {};
  const text = q.query?.trim();
  if (text) {
    const re = new RegExp(escapeRegex(text.replace(/^@/, "")), "i");
    filter.$or = [{ displayName: re }, { email: re }, { handle: re }, { _id: text }];
  }
  if (q.status) filter.status = q.status === "active" ? { $ne: "blocked" } : "blocked";
  if (q.method) filter.signUpMethod = q.method;
  if (q.joinedFrom || q.joinedTo) {
    filter.createdAt = {
      ...(q.joinedFrom ? { $gte: new Date(q.joinedFrom) } : {}),
      ...(q.joinedTo ? { $lt: new Date(new Date(q.joinedTo).getTime() + DAY_MS) } : {}),
    };
  }
  const page = Math.max(1, q.page ?? 1);
  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ ...SORTS[q.sort ?? "-joined"], _id: 1 })
      .collation({ locale: "en", strength: 2 })
      .skip((page - 1) * USERS_PAGE_SIZE)
      .limit(USERS_PAGE_SIZE)
      .lean(),
  ]);

  const uids = docs.map((d) => d._id);
  const [libCounts, friendships] = await Promise.all([
    LibraryItem.aggregate<{ _id: string; n: number }>([{ $match: { uid: { $in: uids } } }, { $group: { _id: "$uid", n: { $sum: 1 } } }]),
    Friendship.find({ status: "accepted", $or: [{ userA: { $in: uids } }, { userB: { $in: uids } }] }, { userA: 1, userB: 1 }).lean(),
  ]);
  const libraryCount = new Map(libCounts.map((c) => [c._id, c.n]));
  const friendsCount = new Map<string, number>();
  for (const f of friendships) for (const u of [f.userA, f.userB]) friendsCount.set(u, (friendsCount.get(u) ?? 0) + 1);

  const rows: AdminUserRow[] = docs.map((d) => ({
    uid: d._id,
    name: d.displayName ?? null,
    handle: d.handle ?? null,
    email: d.email ?? null,
    photoURL: d.photoURL ?? null,
    avatar: { kind: (d.avatar?.kind ?? "monogram") as "photo" | "monogram", tint: d.avatar?.tint ?? "tungsten" },
    signUpMethod: d.signUpMethod ?? null,
    createdAt: iso(d.createdAt),
    lastActiveAt: iso(d.lastActiveAt),
    libraryCount: libraryCount.get(d._id) ?? 0,
    friendsCount: friendsCount.get(d._id) ?? 0,
    status: d.status === "blocked" ? "blocked" : "active",
    role: d.role === "admin" ? "admin" : "user",
  }));
  return { rows, total, page, pageSize: USERS_PAGE_SIZE };
}

// ── One user ────────────────────────────────────────────────────────────────

export async function adminUserProfile(uid: string): Promise<AdminUserProfile> {
  await connectDb();
  const user = await User.findById(uid).lean();
  if (!user) throw notFound("No account with that id.");
  const [record, who] = await Promise.all([
    adminAuth()
      .getUser(uid)
      .catch(() => null),
    people((user.blockHistory ?? []).map((h) => h.by).filter((b) => b !== "system")),
  ]);
  return {
    uid,
    name: user.displayName ?? null,
    handle: user.handle ?? null,
    handleChosen: Boolean(user.handleChosen),
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    avatar: { kind: (user.avatar?.kind ?? "monogram") as "photo" | "monogram", tint: user.avatar?.tint ?? "tungsten" },
    region: user.region,
    languages: user.languages ?? [],
    onboardingDone: Boolean(user.onboardingDone),
    signUpMethod: user.signUpMethod ?? null,
    createdAt: iso(user.createdAt),
    lastActiveAt: iso(user.lastActiveAt),
    role: user.role === "admin" ? "admin" : "user",
    status: user.status === "blocked" ? "blocked" : "active",
    block:
      user.status === "blocked"
        ? { reason: user.block?.reason ?? null, showReason: Boolean(user.block?.showReason), at: iso(user.block?.at), until: iso(user.block?.until), by: user.block?.by ?? null }
        : null,
    blockHistory: (user.blockHistory ?? [])
      .map((h) => ({ action: h.action as "block" | "unblock", reason: h.reason ?? null, at: iso(h.at)!, until: iso(h.until), by: h.by === "system" ? "Automatic" : who(h.by).name }))
      .reverse(),
    privacy: privacyOf(user),
    services: (user.services ?? []) as number[],
    firebase: record
      ? {
          providers: record.providerData.map((p) => p.providerId),
          emailVerified: record.emailVerified,
          disabled: record.disabled,
          createdAt: iso(record.metadata.creationTime),
          lastSignInAt: iso(record.metadata.lastSignInTime),
          lastRefreshAt: iso(record.metadata.lastRefreshTime ?? null),
          admin: record.customClaims?.admin === true,
        }
      : null,
  };
}

export async function adminUserTaste(uid: string): Promise<AdminUserTaste> {
  await connectDb();
  const [profile, snapshots] = await Promise.all([
    (await tasteCol()).findOne({ uid }),
    TasteSnapshot.find({ uid }, { vector: 0 }).sort({ periodStart: 1 }).lean(),
  ]);
  return {
    view: toTasteView(profile),
    answers: profile?.answers ?? null,
    signalCount: profile?.signalCount ?? 0,
    version: profile?.version ?? 0,
    builtAt: iso(profile?.builtAt),
    summarySource: profile?.summarySource ?? null,
    snapshots: snapshots.map((s) => ({
      month: s.periodStart.toISOString().slice(0, 7),
      count: s.count,
      hours: s.hours ?? 0,
      avgRating: s.avgRating ?? null,
      topGenres: (s.genreShare ?? []).slice(0, 3).map((g) => g.term),
      topTitles: (s.topTitles ?? []).slice(0, 3).map((t) => t.title ?? ""),
    })),
  };
}

export async function adminUserLibrary(uid: string) {
  const [overview, entries] = await Promise.all([libraryOverview(uid), getLibraryEntries(uid)]);
  return { overview, entries };
}

export const adminUserWatchlist = (uid: string) => getWatchlist(uid);

export async function adminUserFriends(uid: string): Promise<AdminUserFriends> {
  await connectDb();
  const [friendships, blocks, lists, sent, received] = await Promise.all([
    Friendship.find({ $or: [{ userA: uid }, { userB: uid }] }).lean(),
    UserBlock.find({ $or: [{ blocker: uid }, { blocked: uid }] }).lean(),
    SharedList.find({ memberUids: uid }).lean(),
    Recommendation.find({ fromUid: uid }).sort({ createdAt: -1 }).limit(50).lean(),
    Recommendation.find({ toUid: uid }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const other = (f: { userA: string; userB: string }) => (f.userA === uid ? f.userB : f.userA);
  const [who, title] = await Promise.all([
    people([
      ...friendships.map(other),
      ...blocks.map((b) => (b.blocker === uid ? b.blocked : b.blocker)),
      ...lists.flatMap((l) => l.memberUids),
      ...sent.map((r) => r.toUid),
      ...received.map((r) => r.fromUid),
    ]),
    titleNames([...sent, ...received].map((r) => r.key)),
  ]);
  const rec = (r: (typeof sent)[number], person: string) => ({
    person: who(person),
    title: title(r.key),
    note: r.note || null,
    reaction: r.reaction?.kind ?? null,
    at: iso(r.createdAt)!,
  });
  return {
    friends: friendships.filter((f) => f.status === "accepted").map((f) => ({ person: who(other(f)), since: iso(f.acceptedAt ?? f.createdAt)! })),
    requestsIn: friendships.filter((f) => f.status === "pending" && f.requestedBy !== uid).map((f) => ({ person: who(other(f)), at: iso(f.createdAt)! })),
    requestsOut: friendships.filter((f) => f.status === "pending" && f.requestedBy === uid).map((f) => ({ person: who(other(f)), at: iso(f.createdAt)! })),
    blocked: blocks.filter((b) => b.blocker === uid).map((b) => ({ person: who(b.blocked), at: iso(b.createdAt)! })),
    blockedBy: blocks.filter((b) => b.blocked === uid).map((b) => ({ person: who(b.blocker), at: iso(b.createdAt)! })),
    sharedLists: lists.map((l) => ({
      id: String(l._id),
      name: l.name,
      owner: l.ownerUid === uid,
      members: l.memberUids.filter((m) => m !== uid).map(who),
      items: l.items.length,
    })),
    sent: sent.map((r) => rec(r, r.toUid)),
    received: received.map((r) => rec(r, r.fromUid)),
  };
}

export async function adminUserActivity(uid: string): Promise<AdminUserActivity> {
  await connectDb();
  const [activity, moods, searches] = await Promise.all([
    Activity.find({ uid }).sort({ createdAt: -1 }).limit(50).lean(),
    MoodSession.find({ uid }).sort({ createdAt: -1 }).limit(20).lean(),
    mongoose.connection.db!.collection<{ uid: string; query: string; createdAt: Date }>("searchHistory").find({ uid }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  const title = await titleNames([...activity.map((a) => a.key), ...moods.flatMap((m) => m.picks.map((p) => p.key))]);
  return {
    activity: activity.map((a) => ({ type: a.type, title: title(a.key), rating: a.rating ?? null, at: iso(a.createdAt)! })),
    moods: moods.map((m) => ({
      mood: m.mood?.preset ?? m.mood?.text ?? "Free text",
      time: m.time,
      company: m.company ?? null,
      picks: m.picks.map((p) => title(p.key).title),
      chosen: m.chosenKey ? title(m.chosenKey).title : null,
      at: iso(m.createdAt)!,
    })),
    searches: searches.map((s) => ({ query: s.query, at: iso(s.createdAt)! })),
  };
}

// ── Audit log ───────────────────────────────────────────────────────────────

export async function listAudit(q: { action?: string; admin?: string; target?: string; page?: number }): Promise<AuditPage> {
  await connectDb();
  const filter: Record<string, unknown> = {};
  const action = auditActionFilter(q.action);
  if (action) filter.action = action;
  if (q.admin) filter.adminUid = q.admin;
  if (q.target) filter.targetUid = q.target;
  const page = Math.max(1, q.page ?? 1);
  const [total, docs] = await Promise.all([
    AdminAuditLog.countDocuments(filter),
    AdminAuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * AUDIT_PAGE_SIZE)
      .limit(AUDIT_PAGE_SIZE)
      .lean(),
  ]);
  const who = await people(docs.flatMap((d) => [d.adminUid, d.targetUid].filter((u): u is string => Boolean(u) && u !== "cli")));
  return {
    rows: docs.map((d) => ({
      id: String(d._id),
      at: iso(d.at)!,
      action: d.action,
      // The admin's name today; the email stored with the entry once their account is gone.
      admin:
        d.adminUid === "cli"
          ? { uid: "cli", name: "Command line", handle: null }
          : { uid: d.adminUid, name: who(d.adminUid).name === "Deleted account" ? (d.adminEmail ?? "Deleted account") : who(d.adminUid).name, handle: who(d.adminUid).handle },
      target: d.targetUid ? { uid: d.targetUid, name: who(d.targetUid).name, handle: who(d.targetUid).handle } : null,
      details: (d.details ?? {}) as Record<string, unknown>,
      ip: d.ip ?? null,
    })),
    total,
    page,
    pageSize: AUDIT_PAGE_SIZE,
  };
}
