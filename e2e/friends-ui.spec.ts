import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "friends";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

type Me = { uid: string; handle: string; inviteCode: string };
type Call = Awaited<ReturnType<typeof apiAs>>;

async function setUp(call: Call, ids: number[], genres: string[]) {
  const { user } = await call<{ user: Me }>("/api/users/bootstrap", { method: "POST" });
  await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres, swipes: [], favourites: [] } });
  for (const [i, tmdbId] of ids.entries()) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 10 - (i % 3) } });
  return user;
}

test("friends UI: invite landing and reveal, handle prompt, bell, accept, friends page, profile, search, privacy", async ({ browser }) => {
  test.setTimeout(480_000);
  const ana = await createTempUser("Ana Lumière");
  const ben = await createTempUser("Ben Okafor");
  const cleo = await createTempUser("Cleo Marsh");
  const desktop = { viewport: { width: 1440, height: 900 } };
  try {
    const [A, B, C] = await Promise.all([apiAs(ana.email, ana.password), apiAs(ben.email, ben.password), apiAs(cleo.email, cleo.password)]);
    const meA = await setUp(A, [27205, 157336, 603, 1726, 24428], ["sci-fi", "action"]);
    const meB = await setUp(B, [157336, 603, 24428, 299534, 438631], ["sci-fi", "thriller"]);
    await setUp(C, [11036, 597, 313369, 129], ["romance", "animation"]);
    await new Promise((r) => setTimeout(r, 5000));
    for (const call of [A, B, C]) await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 60_000 }).toBe("ready");

    // Signed out, Ana's invite link says who's inviting, and Join keeps the invite for later.
    const visitor = await browser.newContext(desktop);
    const v = await visitor.newPage();
    await v.goto(`/invite/${meA.inviteCode}`);
    await expect(v.getByRole("heading", { level: 1, name: "Ana invited you to Reverie." })).toBeVisible({ timeout: 30_000 });
    await v.waitForTimeout(1500);
    await shot(v, "invite-signed-out-desktop");
    await v.setViewportSize({ width: 390, height: 844 });
    await shot(v, "invite-signed-out-mobile", true);
    await v.getByRole("link", { name: "Join Reverie" }).click();
    await v.waitForURL((u) => u.pathname === "/signup");
    expect(await v.evaluate(() => localStorage.getItem("rv:pending-invite"))).toContain(meA.inviteCode);
    await visitor.close();

    // Ben arrives from sign-in: the request is sent for him and the avatars snap together.
    const benCtx = await browser.newContext(desktop);
    const b = await benCtx.newPage();
    await signInThroughUi(b, ben.email, ben.password, "/");
    await b.goto(`/invite/${meA.inviteCode}?joined=1`);
    await expect(b.getByRole("heading", { level: 1, name: /You and Ana are \d+% taste match\./ })).toBeVisible({ timeout: 30_000 });
    await expect(b.getByText("Request sent. Ana will see it in their notifications.")).toBeVisible();
    await b.waitForTimeout(2200);
    await shot(b, "invite-reveal-desktop");
    await benCtx.close();

    // Cleo asks too, by handle.
    await C("/api/friends/requests", { method: "POST", body: { handle: meA.handle } });

    // Ana signs in: the one-time handle prompt, then the invite card on Home.
    const anaCtx = await browser.newContext(desktop);
    const page = await anaCtx.newPage();
    await signInThroughUi(page, ana.email, ana.password, "/", { handlePrompt: "show" });
    const prompt = page.getByRole("dialog", { name: "Pick your handle" });
    await expect(prompt).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "handle-prompt-desktop");
    await prompt.getByRole("button", { name: `Keep @${meA.handle}` }).click();
    await expect(page.getByText(`You’re @${meA.handle}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Taste DNA is ready. Compare with a friend?" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shot(page, "home-invite-prompt-desktop");

    // The bell: two requests, answerable right there.
    const bell = page.getByRole("button", { name: /Notifications, 2 new/ });
    await expect(bell).toBeVisible({ timeout: 70_000 });
    await bell.click();
    const panel = page.getByRole("dialog").filter({ hasText: "Notifications" });
    await expect(panel.getByText("wants to be friends")).toHaveCount(2);
    await page.waitForTimeout(500);
    await shot(page, "bell-open-desktop");
    await panel.locator("li").filter({ hasText: "Ben Okafor" }).getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("You and Ben are friends")).toBeVisible();
    await page.keyboard.press("Escape");

    // Friends: Cleo waits; accepting snaps the avatars together.
    await page.goto("/friends");
    await expect(page.getByRole("heading", { level: 1, name: "Friends" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Waiting for you/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /^Ben Okafor/ })).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "friends-requests-desktop", true);
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("You and Cleo are friends now.")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, "friends-accepted-snap-desktop", true);

    // Ben's profile: his ratings (friends see ratings by default) and the taste match.
    await page.getByRole("link", { name: /^Ben Okafor/ }).first().click();
    await page.waitForURL((u) => u.pathname === `/u/${meB.handle}`);
    await expect(page.getByRole("heading", { level: 1, name: "Ben Okafor" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Ben’s ratings/ })).toBeVisible();
    await page.waitForTimeout(2000);
    await shot(page, "profile-friend-desktop");

    // Find friends.
    await page.goto("/friends");
    await page.getByRole("button", { name: "Find friends" }).click();
    const sheet = page.getByRole("dialog", { name: "Find friends" });
    await sheet.getByRole("searchbox", { name: "Handle or name" }).fill(meB.handle.slice(0, 5));
    await expect(sheet.getByText("Ben Okafor")).toBeVisible({ timeout: 30_000 });
    await shot(page, "find-friends-desktop");
    await page.keyboard.press("Escape");

    // Invite friends, from the account menu.
    await page.getByRole("button", { name: "Your account" }).click();
    await page.getByRole("menuitem", { name: "Invite friends" }).click();
    await expect(page.getByRole("img", { name: "QR code for your invite link" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, "invite-sheet-desktop");
    await page.keyboard.press("Escape");

    // Privacy settings.
    await page.goto("/settings#privacy");
    await expect(page.getByRole("radio", { name: /Ratings only/ })).toBeChecked({ timeout: 30_000 });
    await page.getByRole("radio", { name: /Everything/ }).check();
    await expect(page.getByText("Friends can see everything")).toBeVisible();
    await page.getByRole("heading", { name: "Privacy" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, "settings-privacy-desktop");

    // Phones.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/friends");
    await expect(page.getByRole("link", { name: /^Ben Okafor/ })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shot(page, "friends-mobile", true);
    await page.goto(`/u/${meB.handle}`);
    await expect(page.getByRole("heading", { level: 1, name: "Ben Okafor" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, "profile-friend-mobile");
    await page.getByRole("button", { name: /Notifications/ }).click();
    await page.waitForTimeout(500);
    await shot(page, "bell-open-mobile");
    await anaCtx.close();
  } finally {
    for (const u of [ana, ben, cleo]) await deleteTempUser(u.uid);
  }
});
