import { expect, test } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";

type Call = Awaited<ReturnType<typeof apiAs>>;
type Me = { uid: string; handle: string; inviteCode: string; privacy: { friendsSee: string; inTwins: boolean; searchable: boolean } };
type Titles = { card: { key: string } }[] | null;
type Profile = { relation: string; scopes: string[]; match: number | null; ratings: Titles; library: Titles; watchlist: Titles };
type Overview = { friends: { person: { uid: string }; match: number | null }[]; requestsIn: { id: string; person: { uid: string } }[]; blocked: { person: { uid: string } }[] };

// Sci-fi and action for two people with close tastes; romance and animation for the third.
const SCI_FI = [27205, 157336, 603, 1726, 24428, 299534, 438631];
const ROMANCE = [11036, 597, 4348, 313369, 129, 372058, 354912];
const keys = (t: Titles) => (t ?? []).map((x) => x.card.key);

async function setUp(call: Call, ids: number[], genres: string[], hidden: number[] = []) {
  const { user } = await call<{ user: Me }>("/api/users/bootstrap", { method: "POST" });
  await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres, swipes: [], favourites: [] } });
  for (const [i, tmdbId] of ids.entries()) {
    await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 10 - (i % 3), hiddenFromFriends: hidden.includes(tmdbId) } });
  }
  return user;
}

/** Library changes rebuild the taste in the background: wait until the profile has settled. */
async function settle(...calls: Call[]) {
  await new Promise((r) => setTimeout(r, 4000));
  for (const call of calls) {
    await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 60_000 }).toBe("ready");
  }
}

test("friends: requests, privacy levels, hidden items never leak, search opt-out, invites and blocks", async () => {
  test.setTimeout(360_000);
  const ana = await createTempUser("Ana Friend");
  const ben = await createTempUser("Ben Friend");
  const cleo = await createTempUser("Cleo Stranger");
  try {
    const [A, B, C] = await Promise.all([apiAs(ana.email, ana.password), apiAs(ben.email, ben.password), apiAs(cleo.email, cleo.password)]);
    // Ana hides one rated film (Iron Man) and one watchlist title from friends.
    const meA = await setUp(A, SCI_FI.slice(0, 5), ["sci-fi", "action"], [1726]);
    await A("/api/watchlist", { method: "POST", body: { mediaType: "movie", tmdbId: 335984 } });
    await A("/api/watchlist", { method: "POST", body: { mediaType: "movie", tmdbId: 329865, hiddenFromFriends: true } });
    await setUp(B, SCI_FI.slice(1), ["sci-fi", "action"]);
    const meC = await setUp(C, ROMANCE, ["romance", "animation"]);
    await settle(A, B, C);

    // Ben asks by @handle. Ana's bell has it; she accepts; Ben's bell says so.
    await expect(B<{ relation: string }>("/api/friends/requests", { method: "POST", body: { handle: meA.handle } })).resolves.toMatchObject({ relation: "request-sent" });
    const bell = await A<{ items: { type: string; state?: string }[]; unread: number }>("/api/notifications");
    expect(bell.unread).toBe(1);
    expect(bell.items[0]).toMatchObject({ type: "friend_request", state: "pending" });
    const pending = await A<Overview>("/api/friends");
    expect(pending.requestsIn.map((r) => r.person.uid)).toEqual([ben.uid]);
    await expect(A(`/api/friends/requests/${pending.requestsIn[0]!.id}`, { method: "PATCH", body: { action: "accept" } })).resolves.toMatchObject({ relation: "friends" });
    expect((await B<{ items: { type: string }[] }>("/api/notifications")).items[0]).toMatchObject({ type: "friend_accepted" });
    expect((await A<{ items: { state?: string }[] }>("/api/notifications")).items[0]).toMatchObject({ state: "accepted" });

    // Taste match: shown both ways, the same number, and closer tastes score higher.
    const friends = await A<Overview>("/api/friends");
    const abMatch = friends.friends[0]!.match;
    expect(typeof abMatch).toBe("number");
    expect((await B<Overview>("/api/friends")).friends[0]!.match).toBe(abMatch);
    const acMatch = (await A<Profile>(`/api/users/${meC.handle}`)).match;
    console.log(`taste match: Ana–Ben ${abMatch}%, Ana–Cleo ${acMatch}%`);
    expect(abMatch!).toBeGreaterThan(acMatch ?? 0);

    // Default (ratings only): Ben sees Ana's visible ratings, never the hidden film, and nothing else.
    let view = await B<Profile>(`/api/users/${meA.handle}`);
    expect(view).toMatchObject({ relation: "friends", scopes: ["ratings"], library: null, watchlist: null });
    expect(keys(view.ratings)).toEqual(expect.arrayContaining(["movie:27205", "movie:157336", "movie:603"]));
    expect(keys(view.ratings)).not.toContain("movie:1726");

    // Everything: library and watchlist too, still without anything hidden.
    await A("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "everything" } } });
    view = await B<Profile>(`/api/users/${meA.handle}`);
    expect(view.scopes).toEqual(["ratings", "library", "watchlist", "activity"]);
    expect(keys(view.library)).toHaveLength(4);
    expect(keys(view.library)).not.toContain("movie:1726");
    expect(keys(view.watchlist)).toContain("movie:335984");
    expect(keys(view.watchlist)).not.toContain("movie:329865");
    // Changing one privacy setting leaves the others alone.
    expect((await A<Me>("/api/users/me")).privacy).toEqual({ friendsSee: "everything", inTwins: true, searchable: true });

    // Nothing: just the public card.
    await A("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "nothing" } } });
    expect(await B<Profile>(`/api/users/${meA.handle}`)).toMatchObject({ relation: "friends", scopes: [], ratings: null, library: null, watchlist: null });

    // A stranger only ever gets the public card, whatever Ana allows friends.
    await A("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "everything" } } });
    expect(await C<Profile>(`/api/users/${meA.handle}`)).toMatchObject({ relation: "none", scopes: [], ratings: null, library: null, watchlist: null });

    // Ana's own profile shows exactly what friends see: the hidden film isn't there for her either.
    const own = await A<Profile>(`/api/users/${meA.handle}`);
    expect(own.relation).toBe("self");
    expect(keys(own.library)).not.toContain("movie:1726");

    // Search finds Ana by handle until she opts out.
    const search = (call: Call, q: string) => call<{ results: { person: { uid: string } }[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
    expect((await search(C, meA.handle)).results.map((r) => r.person.uid)).toContain(ana.uid);
    await A("/api/users/me", { method: "PATCH", body: { privacy: { searchable: false } } });
    expect((await search(C, meA.handle)).results.map((r) => r.person.uid)).not.toContain(ana.uid);
    await A("/api/users/me", { method: "PATCH", body: { privacy: { searchable: true } } });

    // Cleo opens Ana's invite link: a request lands with Ana. Your own link can't befriend you.
    expect(await C<{ relation: string; person: { uid: string } }>(`/api/invite/${meA.inviteCode}`)).toMatchObject({ relation: "none", person: { uid: ana.uid } });
    expect(await C(`/api/invite/${meA.inviteCode}/accept`, { method: "POST" })).toMatchObject({ relation: "request-sent" });
    expect((await A<Overview>("/api/friends")).requestsIn.map((r) => r.person.uid)).toContain(cleo.uid);
    await expect(A(`/api/invite/${meA.inviteCode}/accept`, { method: "POST" })).rejects.toThrow(/your own invite link/);

    // Ana blocks Cleo: the request goes, and from now on neither can see, find or reach the other.
    await A("/api/blocks", { method: "POST", body: { uid: cleo.uid } });
    const afterBlock = await A<Overview>("/api/friends");
    expect(afterBlock.requestsIn.map((r) => r.person.uid)).not.toContain(cleo.uid);
    expect(afterBlock.blocked.map((b) => b.person.uid)).toEqual([cleo.uid]);
    await expect(C(`/api/users/${meA.handle}`)).rejects.toThrow(/No one here/);
    expect((await search(C, meA.handle)).results).toHaveLength(0);
    await expect(C("/api/friends/requests", { method: "POST", body: { uid: ana.uid } })).rejects.toThrow(/isn’t available/);
    await expect(C(`/api/invite/${meA.inviteCode}/accept`, { method: "POST" })).rejects.toThrow(/doesn’t work/);
    await expect(A(`/api/users/${meC.handle}`)).rejects.toThrow(/No one here/);
    // Unblocking makes them findable again.
    await A(`/api/blocks/${cleo.uid}`, { method: "DELETE" });
    expect((await search(C, meA.handle)).results.map((r) => r.person.uid)).toContain(ana.uid);

    // Ben unfriends Ana: back to strangers.
    await expect(B(`/api/friends/${ana.uid}`, { method: "DELETE" })).resolves.toMatchObject({ removed: true });
    expect(await B<Profile>(`/api/users/${meA.handle}`)).toMatchObject({ relation: "none", scopes: [] });
  } finally {
    for (const u of [ana, ben, cleo]) await deleteTempUser(u.uid);
  }
});
