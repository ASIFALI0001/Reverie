import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "p7";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

// A Marvel / sci-fi action fan who doesn't do romance.
const LIBRARY: [string, number, number][] = [
  ["movie", 1726, 9],
  ["movie", 24428, 10],
  ["movie", 299536, 9],
  ["movie", 155, 10],
  ["movie", 157336, 9],
  ["movie", 27205, 9],
  ["movie", 603, 10],
  ["movie", 11036, 3],
  ["movie", 597, 4],
];

test("match: dial, reasons, curated similar titles and a ranked watchlist", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await createTempUser("Tony Fan");
  try {
    const call = await apiAs(user.email, user.password);
    await call("/api/users/bootstrap", { method: "POST" });
    for (const [mediaType, tmdbId, rating] of LIBRARY) await call("/api/library", { method: "POST", body: { mediaType, tmdbId, rating } });
    await call("/api/onboarding", {
      method: "POST",
      body: { formats: ["movie", "series"], genres: ["sci-fi", "action", "edge-of-seat"], pace: 0.7, tone: 0.6, complexity: 0.7, swipes: [], favourites: [] },
    });
    for (const tmdbId of [135397, 11036, 313369, 19995]) await call("/api/watchlist", { method: "POST", body: { mediaType: "movie", tmdbId } });

    await signInThroughUi(page, user.email, user.password, "/title/movie/68721-iron-man-3");
    await page.goto("/title/movie/68721-iron-man-3");

    // The dial settles on the full match, and the reasons section explains it.
    await expect(page.getByText(/Your match · \d+%/)).toBeVisible({ timeout: 45_000 });
    const heading = page.getByRole("heading", { level: 2, name: /your kind of film|lines up with you|may not be for you/ });
    await expect(heading).toBeVisible();
    const reasons = page.locator('section[aria-labelledby="your-match"] ul li');
    expect(await reasons.count()).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(2500);
    await shot(page, "01-title-hero-desktop");
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await shot(page, "02-your-match-desktop");

    // More like this: curated, each with a why and the viewer's own match. It loads as it nears the viewport.
    for (let i = 1; i <= 6; i++) {
      await page.evaluate((f) => window.scrollTo(0, document.documentElement.scrollHeight * f), i / 6);
      await page.waitForTimeout(400);
    }
    const rail = page.getByRole("list", { name: "More like this" });
    await expect(rail.locator("li").first()).toBeVisible({ timeout: 45_000 });
    await rail.scrollIntoViewIfNeeded();
    expect(await rail.locator("li").count()).toBeGreaterThanOrEqual(8);
    await expect(rail.getByText("Iron Man 2")).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, "03-more-like-this-desktop");

    // Watchlist ranked by match: the romance lands below the dinosaurs.
    await page.goto("/watchlist");
    const rows = page.getByRole("link", { name: /Jurassic World|The Notebook|La La Land|Avatar/ });
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const order = await page.locator("main h3, main [data-watchlist-title]").allInnerTexts().catch(() => []);
    void order;
    const text = await page.locator("main").innerText();
    expect(text.indexOf("Jurassic World")).toBeLessThan(text.indexOf("The Notebook"));
    await page.waitForTimeout(1200);
    await shot(page, "04-watchlist-ranked-desktop");

    // Phones.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/title/movie/68721-iron-man-3");
    await expect(page.getByText(/Your match · \d+%/)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    await shot(page, "05-title-hero-mobile");
    await page.getByRole("heading", { level: 2, name: /your kind of film|lines up with you|may not be for you/ }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await shot(page, "06-your-match-mobile");
  } finally {
    await deleteTempUser(user.uid);
  }
});
