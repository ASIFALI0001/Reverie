import "server-only";
import { createHmac } from "node:crypto";
import { connectDb } from "@/lib/db/connect";
import { tasteCol } from "@/lib/db/taste";
import { titlesCol, CARD_PROJECTION } from "@/lib/db/titles";
import { LibraryItem } from "@/lib/db/models/Library";
import { User, privacyOf, type UserDoc } from "@/lib/db/models/User";
import { TasteTwins } from "@/lib/db/models/Insights";
import { Friendship, TwinConnect, pairOf } from "@/lib/db/models/Social";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import type { TitleKey } from "@/lib/catalog/types";
import { env } from "@/lib/env";
import { notFound } from "@/lib/http/errors";
import { dot } from "@/lib/reco/vector";
import { keepAlive } from "@/lib/reco/taste";
import { centredCosineFromDots, genreCosine, ratingAgreement, scoreFromParts, type SimilarityParts } from "@/lib/social/similarity";
import { blockedAround, friendUids, isBlockedBetween, relationTo } from "@/lib/social/relations";
import { catalogMean } from "@/lib/social/taste-match";
import { SHOWN_TO_FRIENDS } from "@/lib/social/visibility";
import { notify } from "@/lib/social/notifications";
import { peopleByUid, type Person } from "@/lib/social/people";
import { codenames, sharedGenres, TWIN_RULES, twinComponent, twinHues, type TwinRating } from "@/lib/twins/math";
import type { Affinity } from "@/lib/reco/affinity";

/**
 * Taste Twins, the server side. The pool is everyone opted in, not blocked, with enough taste
 * (`twinEligible`, which the taste_vec index filters on). For one person: the nearest 60 in the
 * pool by their social taste (built without titles hidden from friends), then the exact taste
 * match for each, worked out from dot products the database computes, so nobody's vector ever
 * leaves it. Twins are kept per person and recomputed after their profile changes.
 */

/** Atlas vector index on tasteProfiles.socialVector (created by `npm run db:indexes`). */
const TASTE_VECTOR_INDEX = "taste_vec";
const CANDIDATES = 60;

/** Σ field[i] · vec[i], computed by MongoDB. */
const dotExpr = (field: string, vec: ArrayLike<number>) => ({
  $sum: {
    $map: {
      input: { $zip: { inputs: [field, { $literal: Array.from(vec) }] } },
      as: "p",
      in: { $multiply: [{ $arrayElemAt: ["$$p", 0] }, { $arrayElemAt: ["$$p", 1] }] },
    },
  },
});

/** An opaque handle for a twin: the client never sees who it is. */
function tokenFor(viewer: string, twin: string) {
  const secret = env.twinSecret();
  return createHmac("sha256", secret).update(`${viewer}:${twin}`).digest("base64url").slice(0, 22);
}

/** Out of everyone else's twin lists (they opted out, were blocked, or left). */
export async function forgetAsTwin(uid: string) {
  await connectDb();
  await TasteTwins.updateMany({ "twins.twinUid": uid }, { $pull: { twins: { twinUid: uid } } });
}

export type Eligibility = { eligible: boolean; reason: "opted-out" | "not-enough" | "blocked" | null; signals: number };

/** Whether they belong in the pool, kept in step on their profile (and out of others' lists when not). */
export async function refreshTwinEligibility(uid: string): Promise<Eligibility> {
  await connectDb();
  const col = await tasteCol();
  const [user, profile] = await Promise.all([
    User.findById(uid, { privacy: 1, status: 1 }).lean<UserDoc>(),
    col.findOne({ uid }, { projection: { signalCount: 1, socialVector: 1, twinEligible: 1 } }),
  ]);
  const signals = profile?.signalCount ?? 0;
  const reason: Eligibility["reason"] =
    !user || user.status === "blocked" ? "blocked" : !privacyOf(user).inTwins ? "opted-out" : signals < TWIN_RULES.minSignals || !profile?.socialVector?.length ? "not-enough" : null;
  const eligible = reason == null;
  if (profile && Boolean(profile.twinEligible) !== eligible) {
    await col.updateOne({ uid }, { $set: { twinEligible: eligible } });
    if (!eligible) await forgetAsTwin(uid);
  }
  return { eligible, reason, signals };
}

type Scored = { score: number; parts: SimilarityParts; sharedLoved: string[] };

/** The taste match between one person and each of `others` (social side only, never hidden titles). */
async function scoreAgainst(uid: string, others: string[]): Promise<Map<string, Scored>> {
  const out = new Map<string, Scored>();
  if (!others.length) return out;
  const col = await tasteCol();
  const me = await col.findOne({ uid }, { projection: { socialVector: 1, socialGenreAffinity: 1 } });
  if (!me?.socialVector?.length) return out;
  const mean = await catalogMean();
  const muMu = mean ? dot(mean, mean) : 0;
  const aMu = mean ? dot(me.socialVector, mean) : 0;
  const [rows, mine] = await Promise.all([
    col
      .aggregate<{ uid: string; genres: Affinity[] | null; ab: number; bMu: number }>([
        { $match: { uid: { $in: others }, "socialVector.0": { $exists: true } } },
        { $project: { _id: 0, uid: 1, genres: "$socialGenreAffinity", ab: dotExpr("$socialVector", me.socialVector), bMu: mean ? dotExpr("$socialVector", mean) : { $literal: 0 } } },
      ])
      .toArray(),
    LibraryItem.find({ uid, rating: { $ne: null }, ...SHOWN_TO_FRIENDS }, { key: 1, rating: 1 }).lean(),
  ]);
  const myRatings = new Map(mine.map((i) => [i.key, i.rating!]));
  const theirs = myRatings.size
    ? await LibraryItem.find({ uid: { $in: others }, key: { $in: [...myRatings.keys()] }, rating: { $ne: null }, ...SHOWN_TO_FRIENDS }, { uid: 1, key: 1, rating: 1 }).lean()
    : [];
  const pairs = new Map<string, [number, number][]>();
  const loved = new Map<string, { key: string; both: number }[]>();
  for (const t of theirs) {
    const m = myRatings.get(t.key)!;
    if (!pairs.has(t.uid)) pairs.set(t.uid, []);
    pairs.get(t.uid)!.push([m, t.rating!]);
    if (m >= TWIN_RULES.loved && t.rating! >= TWIN_RULES.loved) {
      if (!loved.has(t.uid)) loved.set(t.uid, []);
      loved.get(t.uid)!.push({ key: t.key, both: m + t.rating! });
    }
  }
  for (const r of rows) {
    const parts: SimilarityParts = {
      vector: centredCosineFromDots(r.ab, aMu, r.bMu, muMu),
      ratings: ratingAgreement(pairs.get(r.uid) ?? []),
      genres: genreCosine(me.socialGenreAffinity ?? [], r.genres ?? []),
    };
    const score = scoreFromParts(parts);
    if (score == null) continue;
    const sharedLoved = (loved.get(r.uid) ?? []).sort((a, b) => b.both - a.both).map((x) => x.key);
    out.set(r.uid, { score, parts, sharedLoved });
  }
  return out;
}

/** Recompute someone's twins: nearest in the pool, then exact scores, then the best few. */
export async function computeTwins(uid: string): Promise<void> {
  await connectDb();
  const col = await tasteCol();
  const me = await col.findOne({ uid }, { projection: { socialVector: 1, twinEligible: 1, version: 1 } });
  const now = new Date();
  if (!me?.twinEligible || !me.socialVector?.length) {
    await TasteTwins.updateOne({ uid }, { $set: { profileVersion: me?.version ?? 0, twins: [], computedAt: now } }, { upsert: true });
    return;
  }
  const [hits, blocked, friends] = await Promise.all([
    col
      .aggregate<{ uid: string }>([
        { $vectorSearch: { index: TASTE_VECTOR_INDEX, path: "socialVector", queryVector: me.socialVector, numCandidates: CANDIDATES * 10, limit: CANDIDATES + 1, filter: { twinEligible: true } } },
        { $project: { _id: 0, uid: 1 } },
      ])
      .toArray(),
    blockedAround(uid),
    friendUids(uid),
  ]);
  // Friends you already know; twins are for finding people you don't.
  const known = new Set(friends);
  const candidates = hits.map((h) => h.uid).filter((o) => o !== uid && !blocked.has(o) && !known.has(o));
  const scored = await scoreAgainst(uid, candidates);
  const twins = [...scored.entries()]
    .filter(([, s]) => s.score >= TWIN_RULES.minScore)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, TWIN_RULES.max)
    .map(([twinUid, s]) => ({ twinUid, score: s.score, parts: s.parts, sharedLoved: s.sharedLoved.slice(0, 12), computedAt: now }));
  await TasteTwins.updateOne({ uid }, { $set: { profileVersion: me.version, twins, computedAt: now } }, { upsert: true });
}

/** After a profile rebuild: back in step with the pool, and fresh twins when they're in it. */
export async function afterProfileBuilt(uid: string) {
  const { eligible } = await refreshTwinEligibility(uid);
  await computeTwins(uid);
  return eligible;
}

export type TwinState = "none" | "sent" | "received" | "friends";
export type TwinView = {
  token: string;
  codename: string;
  hues: [number, number];
  score: number;
  /** Up to three genres you both lean toward. */
  sharedGenres: string[];
  sharedLoved: TitleCard[];
  state: TwinState;
  /** Only once you're friends: who they are. */
  friend: Person | null;
};
export type TwinsView = Eligibility & { minSignals: number; twins: TwinView[]; computedAt: string | null };

/** Their twins as they may see them: anonymous until both connect, gone ones left out. */
export async function getTwins(uid: string): Promise<TwinsView> {
  const elig = await refreshTwinEligibility(uid);
  const base = { ...elig, minSignals: TWIN_RULES.minSignals, twins: [] as TwinView[], computedAt: null };
  if (!elig.eligible) return base;
  const col = await tasteCol();
  const profile = await col.findOne({ uid }, { projection: { version: 1 } });
  let doc = await TasteTwins.findOne({ uid }).lean();
  if (!doc) {
    await computeTwins(uid);
    doc = await TasteTwins.findOne({ uid }).lean();
  } else {
    // Your taste changed, or the pool may have: people join, opt in and change too. Someone still
    // waiting for twins is checked again after a minute, everyone else twice a day.
    const age = Date.now() - new Date(doc.computedAt ?? 0).getTime();
    if (doc.profileVersion !== profile?.version || age > 12 * 3_600_000 || (!doc.twins.length && age > 60_000)) keepAlive(computeTwins(uid));
  }

  // People who asked to connect stay visible to you even if they've dropped off your list.
  const incoming = await TwinConnect.find({ to: uid }, { from: 1 }).lean();
  const listed = new Map((doc?.twins ?? []).map((t) => [t.twinUid, t]));
  const extra = incoming.map((c) => c.from).filter((f) => !listed.has(f));
  const extraScores = await scoreAgainst(uid, extra);
  const all = [
    ...(doc?.twins ?? []).map((t) => ({ uid: t.twinUid, score: t.score, sharedLoved: t.sharedLoved ?? [] })),
    ...[...extraScores.entries()].map(([u, s]) => ({ uid: u, score: s.score, sharedLoved: s.sharedLoved })),
  ];
  if (!all.length) return { ...base, computedAt: doc?.computedAt?.toISOString() ?? null };

  // Read-time check: still in the pool, not blocked either way.
  const uids = all.map((t) => t.uid);
  const [stillIn, blocked, sent, received, friendships] = await Promise.all([
    col.find({ uid: { $in: uids }, twinEligible: true }, { projection: { uid: 1 } }).toArray(),
    blockedAround(uid),
    TwinConnect.find({ from: uid, to: { $in: uids } }, { to: 1 }).lean(),
    TwinConnect.find({ to: uid, from: { $in: uids } }, { from: 1 }).lean(),
    Friendship.find({ status: "accepted", $or: uids.map((o) => pairOf(uid, o)) }, { userA: 1, userB: 1 }).lean(),
  ]);
  const inPool = new Set(stillIn.map((p) => p.uid));
  const friendSet = new Set(friendships.map((f) => (f.userA === uid ? f.userB : f.userA)));
  const sentSet = new Set(sent.map((c) => c.to));
  const receivedSet = new Set(received.map((c) => c.from));
  // A twin who became a friend stays on the list (it's how you met) even after leaving the pool.
  const shown = all.filter((t) => !blocked.has(t.uid) && (inPool.has(t.uid) || friendSet.has(t.uid))).sort((a, b) => b.score - a.score);

  const keys = [...new Set(shown.flatMap((t) => t.sharedLoved.slice(0, 4)))] as TitleKey[];
  const [docs, people, tastes] = await Promise.all([
    keys.length ? (await titlesCol()).find({ _id: { $in: keys } }, { projection: CARD_PROJECTION }).toArray() : Promise.resolve([]),
    peopleByUid([...friendSet]),
    // Genres from the tastes friends may see (built without hidden titles), on both sides.
    col.find({ uid: { $in: [uid, ...shown.map((t) => t.uid)] } }, { projection: { uid: 1, socialGenreAffinity: 1 } }).toArray(),
  ]);
  const genresOf = new Map(tastes.map((p) => [p.uid, p.socialGenreAffinity ?? []]));
  const mine = genresOf.get(uid) ?? [];
  const cards = new Map(docs.map((d) => [d._id, toCard(d)]));
  const names = codenames(
    uid,
    shown.map((t) => t.uid),
  );
  return {
    ...base,
    computedAt: doc?.computedAt?.toISOString() ?? null,
    twins: shown.map((t, i) => ({
      token: tokenFor(uid, t.uid),
      codename: names[i]!,
      hues: twinHues(uid, t.uid),
      score: t.score,
      sharedGenres: sharedGenres(mine, genresOf.get(t.uid) ?? []),
      sharedLoved: t.sharedLoved.slice(0, 4).flatMap((k) => cards.get(k as TitleKey) ?? []),
      state: friendSet.has(t.uid) ? "friends" : sentSet.has(t.uid) ? "sent" : receivedSet.has(t.uid) ? "received" : "none",
      friend: friendSet.has(t.uid) ? (people.get(t.uid) ?? null) : null,
    })),
  };
}

/**
 * Connect with a twin. One-sided, they get an anonymous "a Taste Twin wants to connect"; once
 * both have, you're friends (and only then do you learn who each other are).
 */
export async function connectTwin(uid: string, token: string): Promise<{ state: TwinState; friend: Person | null }> {
  await connectDb();
  const doc = await TasteTwins.findOne({ uid }, { twins: 1 }).lean();
  const incoming = await TwinConnect.find({ to: uid }, { from: 1 }).lean();
  const known = [...(doc?.twins ?? []).map((t) => t.twinUid), ...incoming.map((c) => c.from)];
  const twin = known.find((t) => tokenFor(uid, t) === token);
  const gone = () => notFound("That twin isn’t there any more.");
  if (!twin) throw gone();
  const inPool = await (await tasteCol()).countDocuments({ uid: twin, twinEligible: true });
  if (!inPool || (await isBlockedBetween(uid, twin))) throw gone();

  await TwinConnect.updateOne({ from: uid, to: twin }, { $setOnInsert: { from: uid, to: twin, createdAt: new Date() } }, { upsert: true });
  if (!(await TwinConnect.exists({ from: twin, to: uid }))) {
    await notify(twin, "twin_connect", null, { mutual: false });
    return { state: "sent", friend: null };
  }

  // Both tapped Connect: friends.
  const rel = await relationTo(uid, twin);
  if (rel.relation !== "friends") {
    if (rel.friendshipId) await Friendship.updateOne({ _id: rel.friendshipId }, { $set: { status: "accepted", acceptedAt: new Date() } });
    else await Friendship.create({ ...pairOf(uid, twin), status: "accepted", requestedBy: uid, via: "twins", acceptedAt: new Date() });
    await notify(twin, "twin_connect", uid, { mutual: true });
  }
  return { state: "friends", friend: (await peopleByUid([twin])).get(twin) ?? null };
}

/** Your twins' ratings of one title (never hidden ones, never from someone blocked), for the twin nudge. */
export async function twinRatings(uid: string, key: string): Promise<TwinRating[]> {
  await connectDb();
  const doc = await TasteTwins.findOne({ uid }, { twins: 1 }).lean();
  if (!doc?.twins?.length) return [];
  const blocked = await blockedAround(uid);
  const scores = new Map(doc.twins.filter((t) => !blocked.has(t.twinUid)).map((t) => [t.twinUid, t.score]));
  const items = await LibraryItem.find({ uid: { $in: [...scores.keys()] }, key, rating: { $ne: null }, ...SHOWN_TO_FRIENDS }, { uid: 1, rating: 1 }).lean();
  return items.map((i) => ({ score: scores.get(i.uid)!, rating: i.rating! }));
}

/**
 * Titles at least two of your twins loved (8+, never hidden ones) that you haven't logged: the
 * Home row. Ranked by the twins' weighted verdict, then by how many of them loved it.
 */
export async function twinsLoved(uid: string, exclude: Set<string>, limit = 16): Promise<{ key: TitleKey; raters: number; nines: number; t: number }[]> {
  await connectDb();
  const doc = await TasteTwins.findOne({ uid }, { twins: 1 }).lean();
  if (!doc || doc.twins.length < TWIN_RULES.minRaters) return [];
  const blocked = await blockedAround(uid);
  const scores = new Map(doc.twins.filter((t) => !blocked.has(t.twinUid)).map((t) => [t.twinUid, t.score]));
  const groups = await LibraryItem.aggregate<{ _id: string; ratings: { uid: string; rating: number }[] }>([
    { $match: { uid: { $in: [...scores.keys()] }, rating: { $gte: TWIN_RULES.loved }, ...SHOWN_TO_FRIENDS } },
    { $group: { _id: "$key", ratings: { $push: { uid: "$uid", rating: "$rating" } } } },
    { $match: { "ratings.1": { $exists: true } } },
    { $limit: 500 },
  ]);
  return groups
    .filter((g) => !exclude.has(g._id))
    .flatMap((g) => {
      const c = twinComponent(g.ratings.map((r) => ({ score: scores.get(r.uid)!, rating: r.rating })));
      return c ? [{ key: g._id as TitleKey, raters: c.raters, nines: g.ratings.filter((r) => r.rating >= 9).length, t: c.t }] : [];
    })
    .sort((a, b) => b.t - a.t || b.raters - a.raters)
    .slice(0, limit);
}
