import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "twins";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

type Twin = { token: string; codename: string; score: number; sharedLoved: { key: string; title: string }[]; state: string; friend: { name: string } | null };
type Twins = { eligible: boolean; reason: string | null; signals: number; minSignals: number; twins: Twin[] };
type Call = Awaited<ReturnType<typeof apiAs>>;

// Ana loves twelve sci-fi films. Ben shares four of them (and Looper), Eve four others (and
// District 9); both also loved five classics Ana hasn't logged (not sci-fi, so Home's own picks
// for her don't take them first). Dev has Ben's taste but opted out. Cleo loves romance. Nia has
// only three ratings.
const SCIFI_BEN = [157336, 27205, 603, 59967];
const SCIFI_EVE = [329865, 438631, 264660, 17654];
const SCIFI_ANA_ONLY = [335984, 137113, 49047, 286217];
const CLASSICS = [238, 680, 769, 278, 129];
const ROMANCE = [11036, 313369, 4348];
const ROMANCE_MORE = [50646, 122906, 509, 19913, 508, 455207, 639];

async function rate(call: Call, ids: number[], rating: number) {
  for (const tmdbId of ids) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating, status: "watched" } });
}
async function setUp(call: Call, genres: string[]) {
  const { user } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
  await call("/api/users/me/handle", { method: "PATCH", body: { handle: user.handle } });
  await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres, swipes: [], favourites: [] } });
  return user;
}
const ready = (call: Call) => expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 90_000 }).toBe("ready");

test("taste twins: anonymous matches among those who take part, privacy at every step, connect into friends, the nudge and the Home row", async ({ page }) => {
  test.setTimeout(600_000);
  const names = ["Ana Orbit", "Ben Quasar", "Eve Nebula", "Dev Pulsar", "Cleo Rose", "Nia Fresh"];
  const users = await Promise.all(names.map((n) => createTempUser(n)));
  const [ana, ben, eve, dev, cleo] = users;
  try {
    const [A, B, E, D, C, N] = await Promise.all(users.map((u) => apiAs(u!.email, u!.password)));
    await Promise.all([setUp(A!, ["sci-fi"]), setUp(B!, ["sci-fi"]), setUp(E!, ["sci-fi"]), setUp(D!, ["sci-fi"]), setUp(C!, ["romance"]), setUp(N!, ["drama"])]);
    // Dev leaves Taste Twins before rating anything.
    await D!("/api/users/me", { method: "PATCH", body: { privacy: { inTwins: false } } });

    // Everyone but Ana first, so she's matched against a full pool.
    await rate(B!, [...SCIFI_BEN, ...CLASSICS], 10);
    await rate(B!, ROMANCE, 3);
    await rate(E!, [...SCIFI_EVE, ...CLASSICS], 10);
    await rate(E!, ROMANCE, 3);
    await rate(D!, [...SCIFI_BEN, ...CLASSICS], 10);
    await rate(D!, ROMANCE, 3);
    await rate(C!, [...ROMANCE, ...ROMANCE_MORE], 10);
    await rate(C!, SCIFI_BEN.slice(0, 3), 3);
    await rate(N!, [11036, 603, 157336], 8);
    for (const call of [B!, E!, D!, C!]) await ready(call);
    await new Promise((r) => setTimeout(r, 8000));
    await rate(A!, [...SCIFI_BEN, ...SCIFI_EVE, ...SCIFI_ANA_ONLY], 10);
    await rate(A!, ROMANCE, 3);
    await ready(A!);

    // ── Ana's twins: Ben and Eve, anonymous; never Dev (opted out) or Cleo (another taste).
    let mine: Twins = { eligible: false, reason: null, signals: 0, minSignals: 0, twins: [] };
    await expect
      .poll(
        async () => {
          mine = await A!<Twins>("/api/twins");
          return mine.twins.length;
        },
        { timeout: 150_000, intervals: [5000] },
      )
      .toBe(2);
    console.log(`Ana's twins: ${mine.twins.map((t) => `#${t.codename} ${t.score}% [${t.sharedLoved.map((c) => c.title).join(", ")}]`).join(" · ")}`);
    expect(mine.eligible).toBe(true);
    for (const t of mine.twins) {
      expect(t.score).toBeGreaterThanOrEqual(65);
      expect(t.codename).toMatch(/^[A-Z]\d$/);
      expect(t.friend).toBeNull();
    }
    // Anonymous: nothing that identifies anyone ever reaches Ana.
    const raw = JSON.stringify(mine);
    for (const u of [ben, eve, dev, cleo]) {
      expect(raw).not.toContain(u!.uid);
      expect(raw).not.toContain(u!.email);
    }
    for (const n of names.slice(1)) expect(raw).not.toContain(n.split(" ")[1]!);
    const benTwin = () => mine.twins.find((t) => t.sharedLoved.some((c) => c.title === "Looper"))!;
    const eveTwin = () => mine.twins.find((t) => t.sharedLoved.some((c) => c.title === "District 9"))!;
    expect(benTwin()).toBeTruthy();
    expect(eveTwin()).toBeTruthy();

    // Opted out, and not enough taste yet.
    expect(await D!<Twins>("/api/twins")).toMatchObject({ eligible: false, reason: "opted-out", twins: [] });
    expect(await N!<Twins>("/api/twins")).toMatchObject({ eligible: false, reason: "not-enough", signals: 3, minSignals: 10, twins: [] });

    // ── The twin nudge: two of Ana's twins rated The Godfather.
    const godfather = await A!<{ score: number; twins: { raters: number; boost: { from: number; to: number; weight: number } | null } }>("/api/match/movie/238");
    console.log(`The Godfather: ${godfather.score}% ${JSON.stringify(godfather.twins)}`);
    expect(godfather.twins.raters).toBe(2);
    expect(godfather.twins.boost?.weight).toBe(0.15);
    expect(godfather.score).toBe(godfather.twins.boost!.to);

    // ── Home: what her twins loved and she hasn't seen.
    const home = await A!<{ rows: { kind: string; items: { card: { key: string } }[] }[] }>("/api/home");
    const twinRow = home.rows.find((r) => r.kind === "twins");
    expect(twinRow?.items.map((i) => i.card.key).sort()).toEqual(CLASSICS.map((id) => `movie:${id}`).sort());

    // ── Hidden from friends means hidden from twins: hide Looper and it stops being shared.
    await A!("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId: 59967, rating: 10, status: "watched", hiddenFromFriends: true } });
    await expect
      .poll(
        async () => {
          mine = await A!<Twins>("/api/twins");
          return mine.twins.flatMap((t) => t.sharedLoved.map((c) => c.title)).includes("Looper");
        },
        { timeout: 90_000, intervals: [5000] },
      )
      .toBe(false);

    // ── The UI: anonymous cards, Connect on Eve's.
    await signInThroughUi(page, ana!.email, ana!.password, "/settings");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/taste/twins");
    await expect(page.getByRole("heading", { level: 1, name: "Your Taste Twins" })).toBeVisible();
    const eveCard = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: `Twin #${eveTwin().codename}` }) });
    await expect(eveCard).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shot(page, "twins-desktop");
    await eveCard.getByRole("button", { name: "Connect" }).click();
    await expect(eveCard.getByText("Waiting for them to connect too")).toBeVisible({ timeout: 30_000 });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
    const serious = axe.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    if (serious.length) console.log(serious.map((x) => `${x.id}: ${x.nodes[0]?.target.join(" ")}`).join("\n"));
    expect(serious.map((x) => x.id)).toEqual([]);
    await shot(page, "twins-connect-sent-desktop");

    // Eve hears about it anonymously, sees Ana as a twin who wants to connect, and connects back.
    const bell = await E!<{ items: { type: string; actor: unknown; payload: { mutual?: boolean } }[] }>("/api/notifications");
    const ask = bell.items.find((n) => n.type === "twin_connect");
    expect(ask).toMatchObject({ actor: null, payload: { mutual: false } });
    const hers = await E!<Twins>("/api/twins");
    const anaForEve = hers.twins.find((t) => t.state === "received")!;
    expect(anaForEve).toBeTruthy();
    expect(JSON.stringify(hers)).not.toContain(ana!.uid);
    const back = await E!<{ state: string; friend: { name: string } }>("/api/twins/connect", { method: "POST", body: { token: anaForEve.token } });
    expect(back).toMatchObject({ state: "friends", friend: { name: "Ana Orbit" } });
    const friends = await A!<{ friends: { person: { uid: string } }[] }>("/api/friends");
    expect(friends.friends.map((f) => f.person.uid)).toContain(eve!.uid);
    const anaBell = await A!<{ items: { type: string; actor: { name: string } | null; payload: { mutual?: boolean } }[] }>("/api/notifications");
    expect(anaBell.items.find((n) => n.type === "twin_connect")).toMatchObject({ actor: { name: "Eve Nebula" }, payload: { mutual: true } });
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Eve Nebula" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(new RegExp(`met as Twin #${eveTwin().codename}`, "i"))).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "twins-friends-desktop");

    // A bad or someone else's handle is refused.
    await expect(A!("/api/twins/connect", { method: "POST", body: { token: "A".repeat(22) } })).rejects.toThrow("isn’t there any more");

    // ── Blocking: Ana blocks Ben, and he's gone from her twins at once.
    await A!("/api/blocks", { method: "POST", body: { uid: ben!.uid } });
    mine = await A!<Twins>("/api/twins");
    expect(mine.twins.some((t) => t.sharedLoved.some((c) => ["Inception", "Interstellar", "The Matrix"].includes(c.title)) && t.state !== "friends")).toBe(false);

    // ── Phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/taste/twins");
    await expect(page.getByRole("heading", { level: 1, name: "Your Taste Twins" })).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, "twins-mobile", true);
  } finally {
    for (const u of users) await deleteTempUser(u!.uid);
  }
});
