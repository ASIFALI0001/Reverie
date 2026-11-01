import { expect, test } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser, sampleTitles } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

// Design QA for the library + watchlist: screenshots land in .qa/shots/<label>/.
const label = process.env.QA_LABEL ?? "library";
const settle = (page: import("@playwright/test").Page, ms = 1200) => page.waitForTimeout(ms);

test("library + watchlist screens at desktop and mobile @visual", async ({ page }) => {
  test.setTimeout(180_000);
  const user = await createTempUser();
  try {
    const call = await apiAs(user.email, user.password);
    const titles = await sampleTitles(24);
    const now = Date.now();
    // Twenty watched titles spread over the past year, so the chart has a real shape.
    for (const [i, t] of titles.slice(0, 20).entries()) {
      const watchedAt = new Date(now - ((i * 37) % 330) * 86_400_000).toISOString();
      await call("/api/library", {
        method: "POST",
        body: { mediaType: t.mediaType, tmdbId: t.tmdbId, rating: 3 + ((i * 7) % 8), status: i % 6 === 0 ? "watching" : "watched", watchedAt },
      });
    }
    for (const t of titles.slice(20)) await call("/api/watchlist", { method: "POST", body: { mediaType: t.mediaType, tmdbId: t.tmdbId } });

    await signInThroughUi(page, user.email, user.password, "/library");
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForURL((u) => u.pathname === "/");
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Your library" })).toBeVisible();
    await settle(page, 1800);
    await page.screenshot({ path: `.qa/shots/${label}/library-desktop.png` });
    await page.goto("/watchlist");
    await expect(page.getByRole("button", { name: "Mark watched" }).first()).toBeVisible();
    await settle(page, 1500);
    await page.screenshot({ path: `.qa/shots/${label}/watchlist-desktop.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Your library" })).toBeVisible();
    await settle(page, 1800);
    await page.screenshot({ path: `.qa/shots/${label}/library-mobile.png` });
    await page.mouse.wheel(0, 700);
    await settle(page);
    await page.screenshot({ path: `.qa/shots/${label}/library-grid-mobile.png` });

    await page.goto("/library/movies");
    await page.getByRole("radio", { name: "Shelf" }).click();
    await settle(page);
    await page.screenshot({ path: `.qa/shots/${label}/library-shelf-mobile.png` });
    await page.getByRole("radio", { name: "List" }).click();
    await settle(page, 800);
    await page.screenshot({ path: `.qa/shots/${label}/library-list-mobile.png` });
    await page.getByRole("radio", { name: "Poster grid" }).click();

    await page.goto("/watchlist");
    await expect(page.getByRole("button", { name: "Mark watched" }).first()).toBeVisible();
    await settle(page, 1500);
    await page.screenshot({ path: `.qa/shots/${label}/watchlist-mobile.png` });

    // The add sheet is a bottom drawer on phones.
    await page.goto("/title/movie/10138-iron-man-2");
    await page.getByRole("button", { name: "Add to library" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await settle(page, 900);
    await page.screenshot({ path: `.qa/shots/${label}/add-sheet-mobile.png` });
  } finally {
    await deleteTempUser(user.uid);
  }
});
