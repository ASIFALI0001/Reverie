import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";
import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_VERSION } from "../lib/legal";
import { MUSIC_PREF_KEY, MUSIC_SRC } from "../lib/music";

const label = process.env.QA_LABEL ?? "music";
const shot = (page: Page, name: string) => page.screenshot({ path: `.qa/shots/${label}/${name}.png` });
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

/**
 * A browser that has seen the cookie notice but never touched the music (the config mutes it everywhere
 * else). Playwright's own navigations and evaluations count as user gestures, so every page would look
 * already interacted with; here, as for a real visitor, a page counts as interacted with only after a
 * real click, tap or key in it.
 */
async function freshVisitor(browser: Browser, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({
    viewport,
    storageState: { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: [{ name: COOKIE_NOTICE_KEY, value: COOKIE_NOTICE_VERSION }] }] },
  });
  await context.addInitScript(() => {
    let active = false;
    for (const t of ["pointerdown", "keydown", "touchend"]) window.addEventListener(t, (e) => void (e.isTrusted && (active = true)), true);
    Object.defineProperty(Navigator.prototype, "userActivation", { configurable: true, get: () => ({ hasBeenActive: active, isActive: active }) });
  });
  return context;
}

const paused = (page: Page) => page.evaluate(() => document.querySelector<HTMLAudioElement>("[data-site-music]")?.paused ?? true);

test("music: visitors hear it on the landing page and About after their first click; the corner toggle mutes, and it's remembered", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await freshVisitor(browser);
  const page = await context.newPage();
  const fetched: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes(MUSIC_SRC)) fetched.push(r.url());
  });
  // Fades run on animation frames, where a slip (like a volume a hair outside 0–1) throws without failing
  // anything else; and a hydration mismatch is only reported, not thrown. Either shows up here.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|Minified React error #(418|423|425)/i.test(m.text())) errors.push(m.text());
  });

  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Sound", exact: true });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("data-state", "waiting");
  // Nothing downloads with the page.
  await page.waitForTimeout(1500);
  expect(fetched).toEqual([]);

  // The first click anywhere starts it.
  await page.getByRole("heading", { level: 1 }).click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await expect.poll(() => paused(page)).toBe(false);
  expect(fetched.length).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await shot(page, "landing-playing-desktop");

  // It carries on into About without restarting.
  const before = await page.evaluate(() => document.querySelector<HTMLAudioElement>("[data-site-music]")!.currentTime);
  await page.getByRole("navigation", { name: "Primary" }).first().getByRole("link", { name: "About" }).click();
  await page.waitForURL((u) => u.pathname === "/about");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.querySelector<HTMLAudioElement>("[data-site-music]")!.currentTime)).toBeGreaterThanOrEqual(before);
  // Let About's opening finish fading in before checking contrast.
  await page.waitForTimeout(3500);
  const axe =await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) console.log(serious.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} — ${n.failureSummary?.replace(/\n/g, " ")}`).join(" | ")}`).join("\n"));
  expect(serious.map((v) => v.id)).toEqual([]);
  await shot(page, "about-playing-desktop");

  // Muting stops it and is remembered.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("data-state", "off");
  await expect.poll(() => paused(page)).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), MUSIC_PREF_KEY)).toBe("off");
  await shot(page, "about-muted-desktop");

  // Muted, a click elsewhere doesn't start it again; the toggle does.
  await page.getByRole("heading", { level: 1 }).click();
  await page.waitForTimeout(800);
  expect(await paused(page)).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate((k) => localStorage.getItem(k), MUSIC_PREF_KEY)).toBe("on");

  // Any other page: no toggle, and the music fades out.
  await page.getByRole("navigation", { name: "Primary" }).first().getByRole("link", { name: "Search" }).click();
  await page.waitForURL((u) => u.pathname === "/search");
  await expect(toggle).toBeHidden();
  await expect.poll(() => paused(page), { timeout: 5000 }).toBe(true);

  // Phone: the toggle sits above the dock.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(toggle).toBeVisible();
  const box = (await toggle.boundingBox())!;
  const dock = (await page.getByRole("navigation", { name: "Primary" }).last().boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await shot(page, "landing-mobile");
  expect(errors).toEqual([]);
  await context.close();
});

test("music: a signed-in user's Home (also at /) stays silent, with no toggle", async ({ browser }) => {
  test.setTimeout(120_000);
  const user = await createTempUser("Quiet Viewer");
  const context = await freshVisitor(browser);
  try {
    const page = await context.newPage();
    await signInThroughUi(page, user.email, user.password, "/");
    await page.goto("/");
    await page.waitForTimeout(2500);
    await page.mouse.click(700, 300);
    await page.waitForTimeout(1500);
    await expect(page.getByRole("button", { name: "Sound", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelector("[data-site-music]")?.getAttribute("src") ?? null)).toBeNull();
    await page.goto("/about");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("button", { name: "Sound", exact: true })).toHaveCount(0);
  } finally {
    await context.close();
    await deleteTempUser(user.uid);
  }
});
