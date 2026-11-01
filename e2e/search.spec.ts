import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "p8";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

/** The hotkey listener attaches on hydration, which can land after "load"; press until the palette shows. */
async function openPalette(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Search Reverie" });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.keyboard.press("Control+K");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

test("ask search, recent searches and the ⌘K palette", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await createTempUser("Ripley Fan");
  try {
    const call = await apiAs(user.email, user.password);
    await call("/api/users/bootstrap", { method: "POST" });
    for (const [mediaType, tmdbId, rating] of [
      ["movie", 329, 10],
      ["movie", 694, 9],
      ["movie", 348, 9],
      ["movie", 11036, 3],
    ] as const) {
      await call("/api/library", { method: "POST", body: { mediaType, tmdbId, rating } });
    }
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres: ["horror", "sci-fi", "edge-of-seat"], swipes: [], favourites: [] } });

    await signInThroughUi(page, user.email, user.password, "/search");
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1, name: /What will you feel tonight/ })).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "01-search-idle-desktop");

    // Ask. The beam sweeps while it reads; chips first, then ten ranked results with your match.
    await page.getByLabel("Describe what you want to watch").fill("a movie like Jurassic World but scarier");
    await page.getByRole("button", { name: "Ask" }).click();
    await page.waitForTimeout(600);
    await shot(page, "02-search-thinking-desktop");
    await expect(page.getByRole("list", { name: "How Reverie read your request" }).getByText(/Jurassic World/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Top \d+, ranked for you/)).toBeVisible({ timeout: 60_000 });
    const rows = page.locator("main ol > li");
    expect(await rows.count()).toBe(10);
    // "your match" once the batched judgement lands; "estimate" if Gemini was busy (free-tier capacity varies).
    await expect(rows.first().getByText(/^(your match|estimate)$/).filter({ visible: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("q")).toBe("a movie like Jurassic World but scarier");
    await page.waitForTimeout(1500);
    await shot(page, "03-search-results-desktop");
    await shot(page, "03b-search-results-full-desktop", true);

    // Recent searches show on a fresh visit.
    await page.goto("/search");
    await expect(page.getByRole("button", { name: "a movie like Jurassic World but scarier" })).toBeVisible({ timeout: 10_000 });

    // The palette: instant titles, then "Ask" for anything that reads like a mood.
    await page.goto("/library");
    const palette = await openPalette(page);
    await page.waitForTimeout(400);
    await shot(page, "04-palette-empty-desktop");
    await page.keyboard.type("interstellar");
    const film = palette.getByRole("option", { name: /^Interstellar 2014/ });
    await expect(film).toHaveAttribute("data-disabled", "false", { timeout: 10_000 });
    await page.waitForTimeout(300);
    await shot(page, "05-palette-titles-desktop");
    // A bare title leads with the film, so Enter opens it.
    await expect(palette.getByRole("option").first()).toHaveAccessibleName(/^Interstellar 2014/);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/title\/movie\/157336-interstellar/);
    await expect(page.getByRole("heading", { level: 1, name: /Interstellar/ })).toBeVisible({ timeout: 20_000 });

    await openPalette(page);
    await page.keyboard.type("cozy anime for a slow sunday");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/search\?q=cozy/);
    await expect(page.getByText(/Top \d+, ranked for you/)).toBeVisible({ timeout: 60_000 });

    // Phones.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/search?q=${encodeURIComponent("feel-good series for a rainy weekend")}`);
    await expect(page.getByText(/Top \d+, ranked for you/)).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    await shot(page, "06-search-results-mobile");
  } finally {
    await deleteTempUser(user.uid);
  }
});
