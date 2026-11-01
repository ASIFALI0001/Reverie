import "server-only";
import { connectDb } from "@/lib/db/connect";
import { LibraryItem } from "@/lib/db/models/Library";
import { User, privacyOf, type UserDoc } from "@/lib/db/models/User";
import { CARD_PROJECTION, titlesCol } from "@/lib/db/titles";
import { tasteCol } from "@/lib/db/taste";
import { toCard, type TitleCard } from "@/lib/catalog/cards";
import { radarFrom } from "@/lib/reco/affinity";
import { notFound } from "@/lib/http/errors";
import { compareRadars, type AxisLine } from "@/lib/social/compare-taste";
import { peopleByUid, type Person } from "@/lib/social/people";
import { relationTo } from "@/lib/social/relations";
import { tasteMatch } from "@/lib/social/taste-match";
import { SHOWN_TO_FRIENDS, canSee } from "@/lib/social/visibility";
import type { RadarPoint } from "@/lib/taste/types";
import type { TitleKey } from "@/lib/catalog/types";

export type CompareTitle = { card: TitleCard; mine: number | null; theirs: number | null };

export type CompareView = {
  me: Person;
  them: Person;
  match: number | null;
  radars: { mine: RadarPoint[]; theirs: RadarPoint[] };
  agree: AxisLine[];
  clash: AxisLine[];
  /** Null when they don't share their ratings with friends. */
  titles: { bothLoved: CompareTitle[]; theyLoved: CompareTitle[]; splitOn: CompareTitle[] } | null;
};

const LOVED = 8;
const SPLIT = 4;

/**
 * Two friends side by side: where your tastes agree and clash (from the friend-safe taste, so
 * hidden titles never count), both radars, and, if they share ratings, the titles you both
 * loved, what they loved that you haven't seen, and where you split.
 */
export async function compareWith(viewer: string, other: string): Promise<CompareView> {
  await connectDb();
  const rel = await relationTo(viewer, other);
  if (rel.relation !== "friends") throw notFound("You can compare tastes with friends.");
  const [people, owner, profiles, match] = await Promise.all([
    peopleByUid([viewer, other]),
    User.findById(other, { privacy: 1 }).lean<UserDoc>(),
    (await tasteCol()).find({ uid: { $in: [viewer, other] } }, { projection: { uid: 1, socialGenreAffinity: 1, genreAffinity: 1 } }).toArray(),
    tasteMatch(viewer, other),
  ]);
  const me = people.get(viewer);
  const them = people.get(other);
  if (!me || !them || !owner) throw notFound("You can compare tastes with friends.");

  const genres = (uid: string) => {
    const p = profiles.find((x) => x.uid === uid);
    return p?.socialGenreAffinity ?? p?.genreAffinity ?? [];
  };
  const radars = { mine: radarFrom(genres(viewer)), theirs: radarFrom(genres(other)) };
  const { agree, clash } = compareRadars(radars.mine, radars.theirs, them.name.split(" ")[0]!);

  let titles: CompareView["titles"] = null;
  if (canSee("friends", privacyOf(owner).friendsSee, "ratings")) {
    const [mine, theirs] = await Promise.all([
      LibraryItem.find({ uid: viewer }, { key: 1, rating: 1 }).lean(),
      LibraryItem.find({ uid: other, rating: { $ne: null }, ...SHOWN_TO_FRIENDS }, { key: 1, rating: 1 }).lean(),
    ]);
    const myRating = new Map(mine.map((m) => [m.key, m.rating ?? null]));
    const pair = (t: (typeof theirs)[number]) => ({ key: t.key, mine: myRating.get(t.key) ?? null, theirs: t.rating! });
    const bothLoved = theirs
      .filter((t) => t.rating! >= LOVED && (myRating.get(t.key) ?? 0) >= LOVED)
      .map(pair)
      .sort((a, b) => b.mine! + b.theirs - (a.mine! + a.theirs))
      .slice(0, 8);
    const theyLoved = theirs
      .filter((t) => t.rating! >= LOVED && !myRating.has(t.key))
      .map(pair)
      .sort((a, b) => b.theirs - a.theirs)
      .slice(0, 8);
    const splitOn = theirs
      .filter((t) => myRating.get(t.key) != null && Math.abs(myRating.get(t.key)! - t.rating!) >= SPLIT)
      .map(pair)
      .sort((a, b) => Math.abs(b.mine! - b.theirs) - Math.abs(a.mine! - a.theirs))
      .slice(0, 6);
    const keys = [...new Set([...bothLoved, ...theyLoved, ...splitOn].map((t) => t.key as TitleKey))];
    const docs = await (await titlesCol()).find({ _id: { $in: keys } }, { projection: CARD_PROJECTION }).toArray();
    const cards = new Map(docs.map((d) => [d._id as string, toCard(d)]));
    const withCards = (rows: { key: string; mine: number | null; theirs: number }[]) =>
      rows.flatMap((r) => (cards.get(r.key) ? [{ card: cards.get(r.key)!, mine: r.mine, theirs: r.theirs }] : []));
    titles = { bothLoved: withCards(bothLoved), theyLoved: withCards(theyLoved), splitOn: withCards(splitOn) };
  }

  return { me, them, match, radars, agree, clash, titles };
}
