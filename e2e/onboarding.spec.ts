import { expect, test, type Page } from "@playwright/test";
import { createTempUser, deleteTempUser, mongoUserExists } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "p6";
const shot = (page: Page, name: string) => page.screenshot({ path: `.qa/shots/${label}/${name}.png` });

async function playOnboarding(page: Page, vp: "desktop" | "mobile") {
  // Intro
  await expect(page.getByRole("heading", { level: 1, name: /learn your taste/i })).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, `01-intro-${vp}`);
  await page.getByRole("button", { name: "Start" }).click();

  // 1 · Formats
  await expect(page.getByRole("heading", { level: 1, name: /What do you watch/ })).toBeVisible();
  for (const f of ["Movies", "Series", "Anime"]) await page.getByRole("button", { name: new RegExp(`^${f}`) }).click();
  await expect(page.getByRole("button", { name: /^Movies/ })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(700);
  await shot(page, `02-formats-${vp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  // 2 · Moods
  await expect(page.getByRole("heading", { level: 1, name: /Pick what pulls you in/ })).toBeVisible();
  for (const c of ["Sci-Fi", "Thriller", "Mystery", "Mind-bending", "Dark"]) await page.getByRole("button", { name: c, exact: true }).click();
  await page.waitForTimeout(900);
  await shot(page, `03-moods-${vp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  // 3 · Swipe: one real drag (with a mid-drag shot of the stamp), then the keyboard / buttons.
  await expect(page.getByRole("heading", { level: 1, name: /Swipe through these/ })).toBeVisible();
  const card = page.locator('[aria-roledescription="card"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900);
  await shot(page, `04-swipe-${vp}`);
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 + i * 11, box.y + box.height / 2 + i * 2);
  await page.waitForTimeout(150);
  await shot(page, `05-swipe-drag-${vp}`);
  for (let i = 9; i <= 18; i++) await page.mouse.move(box.x + box.width / 2 + i * 14, box.y + box.height / 2 + i * 2);
  await page.mouse.up();
  await page.waitForTimeout(600);

  const verdicts = ["Loved it", "Not for me", "Loved it", "Haven’t seen it", "Loved it", "Not for me"];
  for (let i = 0; i < 19; i++) {
    if (!(await card.isVisible().catch(() => false))) break;
    if (vp === "desktop") await page.keyboard.press(["ArrowRight", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowRight", "ArrowLeft"][i % 6]!);
    else await page.getByRole("button", { name: verdicts[i % 6] }).click();
    await page.waitForTimeout(520);
  }
  await expect(page.getByText("That’s the deck.")).toBeVisible({ timeout: 10_000 });

  // 4 · Favourites (auto-advanced from the finished deck)
  await expect(page.getByRole("heading", { level: 1, name: /Three favourites, ever/ })).toBeVisible({ timeout: 10_000 });
  const search = page.getByPlaceholder("Search any film or series");
  for (const [q, title] of [
    ["interstellar", "Interstellar"],
    ["se7en", "Se7en"],
  ] as const) {
    await search.fill(q);
    // Wait until the results for this query are live (stale ones are disabled), then Enter picks the top hit.
    await expect(page.locator('[cmdk-item]:not([data-disabled="true"])', { hasText: title }).first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: `Remove ${title}`, exact: true })).toBeVisible({ timeout: 5000 });
  }
  await search.fill("parasite");
  await expect(page.locator("[cmdk-item]").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot(page, `06-favourites-${vp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  // 5 · Quick ones
  await expect(page.getByRole("heading", { level: 1, name: /A few quick ones/ })).toBeVisible();
  await page.getByRole("slider", { name: "Pace" }).focus();
  for (let i = 0; i < 25; i++) await page.keyboard.press("ArrowLeft");
  await page.getByRole("slider", { name: "Tone" }).focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: "Ambiguous" }).click();
  await page.getByRole("radio", { name: "Happy to read them" }).click();
  await page.waitForTimeout(500);
  await shot(page, `07-quick-${vp}`);
  await page.getByRole("button", { name: "Build my taste" }).click();

  // 6 · Building → Taste DNA
  await page.waitForTimeout(1600);
  await shot(page, `08-building-${vp}`);
  await expect(page.getByRole("heading", { level: 1, name: /Here’s your taste/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Your Taste DNA")).toBeVisible();
  await expect(page.getByRole("group", { name: /Genre radar/ })).toBeVisible();
  // Taste Twins is on by default, so the reveal says so, with the way to turn it off.
  await expect(page.getByText(/You’re in Taste Twins/)).toBeAttached();
  await expect(page.getByRole("link", { name: "Change this in Settings" })).toHaveAttribute("href", "/settings#privacy");
  await page.waitForTimeout(2200);
  await shot(page, `09-reveal-${vp}`);
}

for (const vp of ["desktop", "mobile"] as const) {
  test(`onboarding game → Taste DNA (${vp})`, async ({ page }) => {
    test.setTimeout(180_000);
    if (vp === "mobile") await page.setViewportSize({ width: 390, height: 844 });
    const user = await createTempUser(vp === "desktop" ? "Ada Lovelace" : "Grace Hopper");
    try {
      await signInThroughUi(page, user.email, user.password, "/onboarding");
      expect(new URL(page.url()).pathname).toBe("/onboarding");
      await playOnboarding(page, vp);

      // The DNA should be real phrases, not empty.
      const phrases = page.locator("ul li span.font-display");
      expect(await phrases.count()).toBeGreaterThanOrEqual(3);

      await page.getByRole("button", { name: "See what to watch" }).click();
      await page.waitForURL((u) => u.pathname === "/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await mongoUserExists(user.uid)).toBe(true);

      // The DNA lives on in Settings, next to "Retake the taste quiz".
      await page.goto("/settings");
      await expect(page.getByText("Your Taste DNA")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("link", { name: "Retake the taste quiz" })).toBeVisible();
      await page.getByText("Your Taste DNA").scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await shot(page, `10-settings-taste-${vp}`);
    } finally {
      await deleteTempUser(user.uid);
    }
  });
}
