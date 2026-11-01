import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "friends-features";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

type Call = Awaited<ReturnType<typeof apiAs>>;
type Me = { uid: string; handle: string };

async function setUp(call: Call, ids: number[], genres: string[]) {
  const { user } = await call<{ user: Me }>("/api/users/bootstrap", { method: "POST" });
  await call("/api/users/me/handle", { method: "PATCH", body: { handle: user.handle } });
  await call("/api/users/me", { method: "PATCH", body: { invitePromptSeen: true } });
  await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres, swipes: [], favourites: [] } });
  for (const [i, tmdbId] of ids.entries()) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 10 - (i % 3) } });
  return user;
}

test("friends features UI: friends on a title, send with the paper plane, Sent to you, Lately, a shared list with a pick, compare", async ({ browser }) => {
  test.setTimeout(480_000);
  const ana = await createTempUser("Ana Lumière");
  const ben = await createTempUser("Ben Okafor");
  const desktop = { viewport: { width: 1440, height: 900 } };
  try {
    const [A, B] = await Promise.all([apiAs(ana.email, ana.password), apiAs(ben.email, ben.password)]);
    await setUp(A, [27205, 157336, 1726, 24428], ["sci-fi", "action"]);
    const meB = await setUp(B, [157336, 603, 24428, 299534, 438631, 335984], ["sci-fi", "thriller"]);
    const { friendshipId } = await A<{ friendshipId: string }>("/api/friends/requests", { method: "POST", body: { handle: meB.handle } });
    await B(`/api/friends/requests/${friendshipId}`, { method: "PATCH", body: { action: "accept" } });
    await B("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "everything" } } });
    await new Promise((r) => setTimeout(r, 4000));
    for (const call of [A, B]) await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 60_000 }).toBe("ready");

    const anaCtx = await browser.newContext(desktop);
    const page = await anaCtx.newPage();
    await signInThroughUi(page, ana.email, ana.password, "/friends");

    // The Matrix: Ben rated it, so he shows up under Ana's match.
    await page.goto("/title/movie/603-the-matrix");
    const friendsLine = page.getByText(/A friend watched this film/);
    await friendsLine.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await expect(friendsLine).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: /Ben \(\d+% match\) rated it 9\/10/ })).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "title-friends-desktop");

    // Send it to Ben with a note: the poster flies off as a paper plane.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Send to a friend" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Send to a friend" });
    await sheet.getByRole("checkbox", { name: /Ben Okafor/ }).check();
    await sheet.getByLabel("A line for them (optional)").fill("Watch it again with me?");
    await page.waitForTimeout(500);
    await shot(page, "send-sheet-desktop");
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForTimeout(420);
    await shot(page, "send-flying-desktop");
    await expect(sheet.getByText("Sent to Ben.")).toBeVisible({ timeout: 15_000 });
    await shot(page, "send-sent-desktop");

    // Friends: what Ben's been watching, and an empty Shared lists section.
    await page.goto("/friends");
    await expect(page.getByRole("heading", { name: "Lately" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    await shot(page, "friends-lately-desktop", true);

    // A shared list with Ben, filled from search, then "Pick for us tonight".
    await page.getByRole("button", { name: "New shared list" }).click();
    const create = page.getByRole("dialog", { name: "New shared list" });
    await create.getByLabel("Name").fill("Weekend with Ben");
    await create.getByRole("checkbox", { name: /Ben Okafor/ }).check();
    await create.getByRole("button", { name: "Create list" }).click();
    await page.waitForURL(/\/lists\/[a-f0-9]{24}$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Weekend with Ben" })).toBeVisible({ timeout: 30_000 });
    for (const q of ["Blade Runner 2049", "Arrival", "The Notebook"]) {
      await page.getByLabel("Add a title").fill(q);
      const hit = page.getByRole("button", { name: new RegExp(`^${q}`) }).first();
      await hit.click({ timeout: 30_000 });
      await expect(page.getByText(`Added ${q}`)).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.getByRole("heading", { name: /On the list/ })).toContainText("3", { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, "shared-list-desktop", true);
    await page.getByRole("button", { name: "Pick for us tonight" }).click();
    await expect(page.getByText("Tonight, for all of you")).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1200);
    await shot(page, "shared-list-pick-desktop");

    // Compare tastes.
    await page.goto(`/u/${meB.handle}/compare`);
    await expect(page.getByRole("heading", { level: 1, name: "You and Ben" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3200);
    await shot(page, "compare-desktop", true);

    // Phones.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/u/${meB.handle}/compare`);
    await expect(page.getByRole("heading", { level: 1, name: "You and Ben" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3200);
    await shot(page, "compare-mobile", true);
    await page.goto("/friends");
    await expect(page.getByRole("heading", { name: "Lately" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    await shot(page, "friends-mobile", true);
    await anaCtx.close();

    // Ben: "Sent to you" on Home and in the library; he replies from there.
    const benCtx = await browser.newContext(desktop);
    const b = await benCtx.newPage();
    await signInThroughUi(b, ben.email, ben.password, "/");
    await expect(b.getByRole("heading", { name: "Sent to you" })).toBeVisible({ timeout: 60_000 });
    await b.getByRole("heading", { name: "Sent to you" }).scrollIntoViewIfNeeded();
    await b.waitForTimeout(1200);
    await shot(b, "home-sent-to-you-desktop");
    await b.goto("/library/sent");
    await expect(b.getByRole("heading", { level: 1, name: "Sent to you" })).toBeVisible({ timeout: 30_000 });
    await expect(b.getByText("“Watch it again with me?”")).toBeVisible();
    await shot(b, "library-sent-desktop");
    await b.getByRole("button", { name: "Add to watchlist" }).first().click();
    await expect(b.getByText("On your watchlist")).toBeVisible({ timeout: 30_000 });
    await b.setViewportSize({ width: 390, height: 844 });
    await b.waitForTimeout(600);
    await shot(b, "library-sent-mobile", true);
    await benCtx.close();

    // Ana hears back in her bell.
    const bell = await A<{ items: { type: string; payload: { kind?: string } }[] }>("/api/notifications");
    expect(bell.items[0]).toMatchObject({ type: "recommendation_reaction", payload: { kind: "watchlisted" } });
  } finally {
    for (const u of [ana, ben]) await deleteTempUser(u.uid);
  }
});
