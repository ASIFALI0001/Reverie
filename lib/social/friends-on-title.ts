import "server-only";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { User, privacyOf, type UserDoc } from "@/lib/db/models/User";
import { applyFriendBoost } from "@/lib/social/friend-boost";
import { peopleByUid, type Person } from "@/lib/social/people";
import { friendUids } from "@/lib/social/relations";
import { tasteMatches } from "@/lib/social/taste-match";
import { SHOWN_TO_FRIENDS, canSee } from "@/lib/social/visibility";

export type FriendOnTitle = { person: Person; tasteMatch: number | null; rating: number | null; status: string };
export type FriendsOnTitle = {
  /** Friends who watched it, as far as you're allowed to know. */
  count: number;
  /** Raters first, closest taste first (at most 8, for the avatars). */
  friends: FriendOnTitle[];
  /** How their ratings moved your match, when they did. */
  boost: { from: number; to: number; weight: number } | null;
  /** Every visible friend rating (taste match + rating), for combining with other nudges. Server-side only. */
  ratings?: { tasteMatch: number; rating: number }[];
};

const EMPTY: FriendsOnTitle = { count: 0, friends: [], boost: null };

/**
 * "3 friends watched this · Rahul (82% match) rated it 9/10", and the friend nudge to the match.
 * A friend counts only as far as their privacy allows: "Everything" shows they watched it,
 * "Ratings only" shows it only if they rated it, "Nothing" never. Hidden titles never count.
 */
export async function friendsOnTitle(viewer: string, key: string, baseScore: number | null): Promise<FriendsOnTitle> {
  await connectDb();
  const friends = await friendUids(viewer);
  if (!friends.length) return EMPTY;
  const items = await LibraryItem.find({ uid: { $in: friends }, key, ...SHOWN_TO_FRIENDS }, { uid: 1, rating: 1, status: 1 }).lean();
  if (!items.length) return EMPTY;
  const owners = await User.find({ _id: { $in: items.map((i) => i.uid) }, status: { $ne: "blocked" } }, { privacy: 1 }).lean<UserDoc[]>();
  const sees = new Map(owners.map((o) => [o._id, privacyOf(o).friendsSee]));
  const visible = items.filter((i) => {
    const setting = sees.get(i.uid);
    if (!setting) return false;
    return canSee("friends", setting, "library") || (canSee("friends", setting, "ratings") && i.rating != null);
  });
  if (!visible.length) return EMPTY;

  const [people, matches] = await Promise.all([peopleByUid(visible.map((i) => i.uid)), tasteMatches(viewer, visible.map((i) => i.uid))]);
  const rows = visible
    .flatMap((i) => {
      const person = people.get(i.uid);
      return person ? [{ person, tasteMatch: matches.get(i.uid) ?? null, rating: i.rating ?? null, status: i.status }] : [];
    })
    .sort((a, b) => Number(b.rating != null) - Number(a.rating != null) || (b.tasteMatch ?? -1) - (a.tasteMatch ?? -1));

  let boost: FriendsOnTitle["boost"] = null;
  const rated = rows.flatMap((r) => (r.rating != null && r.tasteMatch != null ? [{ tasteMatch: r.tasteMatch, rating: r.rating }] : []));
  if (baseScore != null) {
    const { score, weight } = applyFriendBoost(baseScore, rated);
    if (weight > 0) boost = { from: baseScore, to: score, weight };
  }
  return { count: rows.length, friends: rows.slice(0, 8), boost, ratings: rated };
}
