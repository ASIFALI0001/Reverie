import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser, setAdmin } from "./helpers/admin";
import { adminSignIn, signInThroughUi } from "./helpers/session";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: Page, path: string, ready?: () => Promise<void>) {
  await page.goto(path);
  if (ready) await ready();
  await page.waitForTimeout(1500); // let entrance animations settle (opacity affects contrast checks)
  const result = await new AxeBuilder({ page })
    .withTags(TAGS)
    // The decorative grain overlay and the Next dev indicator aren't ours to audit.
    .exclude(".grain")
    .exclude("nextjs-portal")
    .analyze();
  const issues = result.violations.map(
    (v) => `${v.impact} · ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}\n    ${v.nodes[0]?.failureSummary?.replace(/\n/g, " ") ?? ""}`,
  );
  if (issues.length) console.log(`\n${path}\n  ${issues.join("\n  ")}`);
  return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test("accessibility: signed-out pages", async ({ page }) => {
  test.setTimeout(240_000);
  const serious = [
    ...(await audit(page, "/")),
    ...(await audit(page, "/signin")),
    ...(await audit(page, "/signup")),
    ...(await audit(page, "/search")),
    ...(await audit(page, "/title/movie/68721-iron-man-3", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible())),
    ...(await audit(page, "/person/525", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible())),
    ...(await audit(page, "/this-page-does-not-exist")),
  ];
  expect(serious.map((v) => v.id)).toEqual([]);
});

test("accessibility: signed-in pages", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await createTempUser("Axe Tester");
  try {
    const call = await apiAs(user.email, user.password);
    const { user: me } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
    // Confirm the suggested handle, so the one-time handle prompt doesn't open over the pages under audit.
    await call("/api/users/me/handle", { method: "PATCH", body: { handle: me.handle } });
    for (const [mediaType, tmdbId, rating] of [
      ["movie", 157336, 10],
      ["movie", 27205, 9],
      ["tv", 1396, 9],
    ] as const) {
      await call("/api/library", { method: "POST", body: { mediaType, tmdbId, rating } });
    }
    await call("/api/watchlist", { method: "POST", body: { mediaType: "movie", tmdbId: 335984 } });
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres: ["sci-fi"], swipes: [], favourites: [] } });
    await signInThroughUi(page, user.email, user.password, "/settings");
    const serious = [
      ...(await audit(page, "/", () => expect(page.getByText("Tonight", { exact: true })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, "/library", () => expect(page.getByRole("heading", { level: 1, name: "Your library" })).toBeVisible())),
      ...(await audit(page, "/watchlist", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible())),
      ...(await audit(page, "/settings", () => expect(page.getByLabel("Display name")).toBeVisible())),
      ...(await audit(page, "/title/movie/68721-iron-man-3", () => expect(page.getByText(/Your match · \d+%/)).toBeVisible({ timeout: 45_000 }))),
      ...(await audit(page, "/onboarding", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible())),
    ];
    expect(serious.map((v) => v.id)).toEqual([]);
  } finally {
    await deleteTempUser(user.uid);
  }
});

test("accessibility: admin pages", async ({ page }) => {
  test.setTimeout(240_000);
  const admin = await createTempUser("Axe Admin");
  await setAdmin(admin.uid, true);
  try {
    const login = await audit(page, "/admin/login", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible());
    await adminSignIn(page, admin.email, admin.password);
    await page.waitForURL((u) => u.pathname === "/admin", { timeout: 60_000 });
    const serious = [
      ...login,
      ...(await audit(page, "/admin", () => expect(page.getByRole("img", { name: /Sign-ups per day/ })).toBeVisible({ timeout: 60_000 }))),
      ...(await audit(page, "/admin/users", () => expect(page.getByRole("link", { name: /Axe Admin/ })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/admin/users/${admin.uid}`, () => expect(page.getByRole("heading", { level: 1, name: "Axe Admin" })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/admin/users/${admin.uid}?tab=admin`, () => expect(page.getByText("Opened the profile").first()).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, "/admin/audit", () => expect(page.getByRole("radiogroup", { name: "Show" })).toBeVisible())),
      ...(await audit(page, "/privacy", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible())),
    ];
    expect(serious.map((v) => v.id)).toEqual([]);
  } finally {
    await deleteTempUser(admin.uid);
  }
});

test("accessibility: friends pages", async ({ page }) => {
  test.setTimeout(240_000);
  const ana = await createTempUser("Axe Ana");
  const ben = await createTempUser("Axe Ben");
  try {
    const [A, B] = await Promise.all([apiAs(ana.email, ana.password), apiAs(ben.email, ben.password)]);
    const setUp = async (call: typeof A) => {
      const { user } = await call<{ user: { handle: string; inviteCode: string } }>("/api/users/bootstrap", { method: "POST" });
      await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres: ["sci-fi"], swipes: [], favourites: [] } });
      await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId: 157336, rating: 9 } });
      await call("/api/users/me/handle", { method: "PATCH", body: { handle: user.handle } });
      return user;
    };
    const meA = await setUp(A);
    const meB = await setUp(B);
    const req = await B<{ friendshipId: string }>("/api/friends/requests", { method: "POST", body: { handle: meA.handle } });
    await A(`/api/friends/requests/${req.friendshipId}`, { method: "PATCH", body: { action: "accept" } });
    // Friends features: a title sent to Ana, Ben's activity, a shared list with a title on it.
    await B("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "everything" } } });
    await B("/api/recommendations", { method: "POST", body: { mediaType: "movie", tmdbId: 329865, to: [ana.uid], note: "You’ll love the ending." } });
    const { id: listId } = await A<{ id: string }>("/api/shared-lists", { method: "POST", body: { name: "Axe night", members: [ben.uid] } });
    await A(`/api/shared-lists/${listId}/items`, { method: "POST", body: { mediaType: "movie", tmdbId: 335984 } });

    // Signed out: the invite landing.
    const serious = [...(await audit(page, `/invite/${meB.inviteCode}`, () => expect(page.getByRole("link", { name: "Join Reverie" })).toBeVisible({ timeout: 30_000 })))];
    await signInThroughUi(page, ana.email, ana.password, "/friends");
    serious.push(
      ...(await audit(page, "/friends", () => expect(page.getByRole("link", { name: /^Axe Ben/ })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/u/${meB.handle}`, () => expect(page.getByRole("heading", { level: 1, name: "Axe Ben" })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/u/${meA.handle}`, () => expect(page.getByText("This is what your friends see.")).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/invite/${meB.inviteCode}`, () => expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, "/settings#privacy", () => expect(page.getByRole("radio", { name: /Ratings only/ })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/u/${meB.handle}/compare`, () => expect(page.getByRole("heading", { level: 1, name: "You and Axe" })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, `/lists/${listId}`, () => expect(page.getByRole("heading", { level: 1, name: "Axe night" })).toBeVisible({ timeout: 30_000 }))),
      ...(await audit(page, "/library/sent", () => expect(page.getByText("“You’ll love the ending.”")).toBeVisible({ timeout: 30_000 }))),
    );
    expect(serious.map((v) => v.id)).toEqual([]);
  } finally {
    await deleteTempUser(ana.uid);
    await deleteTempUser(ben.uid);
  }
});
