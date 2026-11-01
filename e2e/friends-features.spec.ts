import { expect, test } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";

type Call = Awaited<ReturnType<typeof apiAs>>;
type Me = { uid: string; handle: string };
type Inbox = { items: { id: string; from: { uid: string }; card: { key: string }; note: string | null; match: number | null; reaction: { kind: string; rating: number | null } | null }[]; waiting: number };
type Bell = { items: { type: string; payload: Record<string, unknown> }[] };
type Match = { status: string; score: number; friends: { count: number; friends: { person: { uid: string }; rating: number | null; tasteMatch: number | null }[]; boost: { from: number; to: number } | null } | null };
type Activity = { items: { person: { uid: string }; type: string; card: { key: string } }[] };
type List = { id: string; members: { uid: string }[]; items: { key: string; matches: { uid: string; match: number | null }[]; combined: number | null }[] };

async function setUp(call: Call, ids: number[], genres: string[]) {
  const { user } = await call<{ user: Me }>("/api/users/bootstrap", { method: "POST" });
  await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres, swipes: [], favourites: [] } });
  for (const [i, tmdbId] of ids.entries()) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 10 - (i % 3) } });
  return user;
}

async function befriend(from: Call, to: Call, toHandle: string) {
  const { friendshipId } = await from<{ friendshipId: string }>("/api/friends/requests", { method: "POST", body: { handle: toHandle } });
  await to(`/api/friends/requests/${friendshipId}`, { method: "PATCH", body: { action: "accept" } });
}

test("friends features: send to a friend + replies, friend-boosted match, activity, shared lists, compare — and privacy at each step", async () => {
  test.setTimeout(420_000);
  const ana = await createTempUser("Ana Features");
  const ben = await createTempUser("Ben Features");
  const cleo = await createTempUser("Cleo Features");
  try {
    const [A, B, C] = await Promise.all([apiAs(ana.email, ana.password), apiAs(ben.email, ben.password), apiAs(cleo.email, cleo.password)]);
    // Ben has rated The Matrix (603); Ana hasn't seen it.
    const meA = await setUp(A, [27205, 157336, 1726, 24428], ["sci-fi", "action"]);
    await setUp(B, [157336, 603, 24428, 299534, 438631], ["sci-fi", "action"]);
    await setUp(C, [11036, 597, 313369], ["romance", "animation"]);
    await new Promise((r) => setTimeout(r, 4000));
    for (const call of [A, B, C]) await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 60_000 }).toBe("ready");

    // Only friends can be sent things.
    await expect(A("/api/recommendations", { method: "POST", body: { mediaType: "movie", tmdbId: 329865, to: [ben.uid] } })).rejects.toThrow(/Pick at least one friend/);
    await befriend(B, A, meA.handle);

    // Send to a friend: Ben's inbox has it with his own match and Ana's note; the bell says so.
    await A("/api/recommendations", { method: "POST", body: { mediaType: "movie", tmdbId: 329865, to: [ben.uid], note: "The ending! Trust me." } });
    let inbox = await B<Inbox>("/api/recommendations/inbox");
    expect(inbox.waiting).toBe(1);
    expect(inbox.items[0]).toMatchObject({ from: { uid: ana.uid }, card: { key: "movie:329865" }, note: "The ending! Trust me.", reaction: null });
    expect(typeof inbox.items[0]!.match).toBe("number");
    expect((await B<Bell>("/api/notifications")).items[0]).toMatchObject({ type: "recommendation", payload: { title: "Arrival" } });
    // Sending again before he answers refreshes it rather than stacking a duplicate.
    await A("/api/recommendations", { method: "POST", body: { mediaType: "movie", tmdbId: 329865, to: [ben.uid] } });
    expect((await B<Inbox>("/api/recommendations/inbox")).items).toHaveLength(1);

    // Ben replies "Watched it — 8/10": it lands in his library, and Ana hears back. Only the recipient can reply.
    await expect(A(`/api/recommendations/${inbox.items[0]!.id}`, { method: "PATCH", body: { reaction: { kind: "watched", rating: 8 } } })).rejects.toThrow(/isn’t there any more/);
    await B(`/api/recommendations/${inbox.items[0]!.id}`, { method: "PATCH", body: { reaction: { kind: "watched", rating: 8 } } });
    const [arrival] = (await B<{ items: { rating: number; status: string }[] }>("/api/library?key=movie:329865")).items;
    expect(arrival).toMatchObject({ rating: 8, status: "watched" });
    expect((await A<Bell>("/api/notifications")).items[0]).toMatchObject({ type: "recommendation_reaction", payload: { kind: "watched", rating: 8 } });
    inbox = await B<Inbox>("/api/recommendations/inbox");
    expect(inbox).toMatchObject({ waiting: 0, items: [{ reaction: { kind: "watched", rating: 8 } }] });

    // Friend-boosted match: Ben rated The Matrix, so Ana sees him on its match, and it moves her score.
    let match = await A<Match>("/api/match/movie/603");
    expect(match.status).toBe("ok");
    expect(match.friends).toMatchObject({ count: 1, friends: [{ person: { uid: ben.uid }, rating: 9 }] });
    expect(match.friends!.boost).not.toBeNull();
    expect(match.score).toBe(match.friends!.boost!.to);
    console.log(`friend boost on The Matrix: ${match.friends!.boost!.from} → ${match.friends!.boost!.to}`);
    // Once Ben hides it from friends, it never counts.
    await B("/api/library/movie/603", { method: "PATCH", body: { hiddenFromFriends: true } });
    match = await A<Match>("/api/match/movie/603");
    expect(match.friends?.count ?? 0).toBe(0);

    // Activity: Ben shares ratings only by default, so Ana sees none of his activity…
    expect((await A<Activity>("/api/activity/friends")).items).toHaveLength(0);
    // …until he shares everything; hidden titles still never appear.
    await B("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "everything" } } });
    let feed = await A<Activity>("/api/activity/friends");
    const keys = feed.items.map((i) => i.card.key);
    expect(keys).toEqual(expect.arrayContaining(["movie:329865", "movie:157336"]));
    expect(keys).not.toContain("movie:603");
    expect(feed.items.every((i) => i.person.uid === ben.uid)).toBe(true);
    await B("/api/library/movie/329865", { method: "PATCH", body: { hiddenFromFriends: true } });
    feed = await A<Activity>("/api/activity/friends");
    expect(feed.items.map((i) => i.card.key)).not.toContain("movie:329865");
    // Strangers see nothing.
    expect((await C<Activity>("/api/activity/friends")).items).toHaveLength(0);

    // Shared list with Ben: sorted by combined match, each member's match on every title.
    await expect(A("/api/shared-lists", { method: "POST", body: { name: "Weekend", members: [cleo.uid] } })).rejects.toThrow(/at least one friend/);
    const { id } = await A<{ id: string }>("/api/shared-lists", { method: "POST", body: { name: "Weekend with Ben", members: [ben.uid] } });
    expect((await B<Bell>("/api/notifications")).items[0]).toMatchObject({ type: "shared_list_invite", payload: { name: "Weekend with Ben" } });
    for (const [call, tmdbId] of [[A, 335984], [B, 78], [A, 11036], [B, 680]] as const) await call(`/api/shared-lists/${id}/items`, { method: "POST", body: { mediaType: "movie", tmdbId } });
    const list = await B<List>(`/api/shared-lists/${id}`);
    expect(list.members.map((m) => m.uid).sort()).toEqual([ana.uid, ben.uid].sort());
    expect(list.items).toHaveLength(4);
    for (const item of list.items) expect(item.matches.map((m) => m.uid).sort()).toEqual([ana.uid, ben.uid].sort());
    const combined = list.items.map((i) => i.combined ?? -1);
    expect([...combined].sort((x, y) => y - x)).toEqual(combined);
    const { pick } = await A<{ pick: { key: string; reason: string; combined: number } }>(`/api/shared-lists/${id}/pick`, { method: "POST" });
    expect(pick.key).toBe(list.items[0]!.key);
    expect(pick.reason.length).toBeGreaterThan(10);
    console.log(`pick: ${pick.key} (${pick.combined}%): ${pick.reason}`);
    // Not a member: the list doesn't exist for you.
    await expect(C(`/api/shared-lists/${id}`)).rejects.toThrow(/isn’t there any more/);
    // Only the owner renames.
    await expect(B(`/api/shared-lists/${id}`, { method: "PATCH", body: { name: "Mine now" } })).rejects.toThrow(/owner/);

    // Compare: friends only. Ben shares everything, so titles are included.
    const cmp = await A<{ match: number; radars: { mine: unknown[]; theirs: unknown[] }; titles: { bothLoved: { card: { key: string } }[] } | null }>(`/api/friends/${ben.uid}/compare`);
    expect(cmp.radars.mine).toHaveLength(8);
    expect(cmp.titles).not.toBeNull();
    expect(cmp.titles!.bothLoved.map((t) => t.card.key)).toEqual(expect.arrayContaining(["movie:157336"]));
    await expect(A(`/api/friends/${cleo.uid}/compare`)).rejects.toThrow(/with friends/);

    // Blocking separates you on shared lists too: Ben blocks Ana and leaves her list.
    await B("/api/blocks", { method: "POST", body: { uid: ana.uid } });
    expect((await A<List>(`/api/shared-lists/${id}`)).members.map((m) => m.uid)).toEqual([ana.uid]);
    await expect(B(`/api/shared-lists/${id}`)).rejects.toThrow(/isn’t there any more/);
    expect((await B<Inbox>("/api/recommendations/inbox")).items).toHaveLength(0);
  } finally {
    for (const u of [ana, ben, cleo]) await deleteTempUser(u.uid);
  }
});
