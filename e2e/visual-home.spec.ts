import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "p9";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`landing scroll story (${vp.name}) @visual`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Know you’ll love it/ })).toBeVisible();
    await page.waitForTimeout(1800);
    await shot(page, `01-landing-hero-${vp.name}`);
    const story = page.getByRole("region", { name: "How Reverie learns your taste" });
    const top = await story.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    // The pinned scene runs over ~320% of the viewport; step through its four beats.
    for (const [i, f] of [0.05, 0.9, 1.9, 3.1].entries()) {
      await page.evaluate((y) => window.scrollTo(0, y), top + vp.height * f);
      await page.waitForTimeout(1600);
      await shot(page, `02-landing-beat${i + 1}-${vp.name}`);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1500);
    await shot(page, `03-landing-end-${vp.name}`);
  });
}

test("home feed: tonight + rows @visual", async ({ page }) => {
  test.setTimeout(180_000);
  const user = await createTempUser("Nolan Fan");
  try {
    const call = await apiAs(user.email, user.password);
    await call("/api/users/bootstrap", { method: "POST" });
    const lib: [string, number, number, string?][] = [
      ["movie", 157336, 10],
      ["movie", 27205, 9],
      ["movie", 603, 10],
      ["movie", 155, 9],
      ["movie", 329, 9],
      ["movie", 11036, 3],
      ["tv", 1396, 10],
      ["tv", 66732, 8, "watching"],
    ];
    for (const [mediaType, tmdbId, rating, status] of lib) {
      await call("/api/library", { method: "POST", body: { mediaType, tmdbId, rating, status: status ?? "watched" } });
    }
    for (const tmdbId of [335984, 329865]) await call("/api/watchlist", { method: "POST", body: { mediaType: "movie", tmdbId } });
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie", "series"], genres: ["sci-fi", "thriller", "mind-bending"], swipes: [], favourites: [] } });

    await signInThroughUi(page, user.email, user.password, "/");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nolan");
    await expect(page.getByRole("heading", { level: 2, name: /./ }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Tonight", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("list", { name: "Picked for you tonight" })).toBeVisible();
    await expect(page.getByRole("list", { name: /Because you (loved|liked)/ }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Finish what you started" })).toBeVisible();
    await page.waitForTimeout(2500);
    await shot(page, "04-home-desktop");
    await shot(page, "04b-home-full-desktop", true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByText("Tonight", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    await shot(page, "05-home-mobile");
  } finally {
    await deleteTempUser(user.uid);
  }
});
