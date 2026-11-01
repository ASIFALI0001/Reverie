import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const label = process.env.QA_LABEL ?? "about";
const shot = (page: Page, name: string) => page.screenshot({ path: `.qa/shots/${label}/${name}.png` });
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const CHAPTERS = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15"];

/** Let the posters in view finish arriving (TMDB's JPEGs paint top-down while they load). */
async function settle(page: Page) {
  await page
    .waitForFunction(
      () =>
        [...document.images].every((img) => {
          const r = img.getBoundingClientRect();
          return img.complete || r.width === 0 || r.bottom < 0 || r.top > window.innerHeight;
        }),
      null,
      { timeout: 6000 },
    )
    .catch(() => {});
}

/** Click a chapter on the rail; it should arrive at the top and still be there a moment later. */
async function goVia(page: Page, name: string) {
  const rail = page.getByRole("navigation", { name: "Chapters" });
  const id = `ch-${name.slice(0, 2)}`;
  const top = () => page.evaluate((x) => Math.abs(document.getElementById(x)!.getBoundingClientRect().top), id);
  await rail.getByRole("link", { name }).click();
  await expect.poll(top, { timeout: 10_000 }).toBeLessThan(80);
  await page.waitForTimeout(1500);
  expect(await top()).toBeLessThan(80);
  await expect(rail.getByRole("link", { name })).toHaveAttribute("aria-current", "location");
}

/** Scroll through every chapter (and through each pinned scene), shooting as we go. */
async function walk(page: Page, prefix: string) {
  for (const n of CHAPTERS) {
    const top = await page.evaluate((id) => {
      const el = document.getElementById(`ch-${id}`)!;
      return el.getBoundingClientRect().top + window.scrollY;
    }, n);
    const height = await page.evaluate((id) => document.getElementById(`ch-${id}`)!.getBoundingClientRect().height, n);
    const vh = await page.evaluate(() => window.innerHeight);
    // A pinned chapter is taller than a screen (its pin spacer): shoot early, middle and late in it.
    const stops = height > vh * 1.5 ? [0.05, 0.45, 0.85].map((f) => top + (height - vh) * f) : [top];
    for (const [i, y] of stops.entries()) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(1500);
      await settle(page);
      await shot(page, `${prefix}-${n}${stops.length > 1 ? `-${i + 1}` : ""}`);
    }
  }
}

test("about: sixteen chapters, the rail and counter, desktop and phone, reduced motion, axe and the share image", async ({ page }) => {
  test.setTimeout(420_000);

  // The words are in the page before any script runs.
  const html = await (await fetch(`${BASE}/about`)).text();
  for (const words of ["Your taste, learned.", "Every title gets a number made just for you.", "Meet your Taste Twins.", "Your next favourite is waiting.", "Made by Asif"]) {
    expect(html).toContain(words);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "Reverie" })).toBeVisible();
  expect(await page.locator("[data-chapter]").count()).toBe(16);
  const rail = page.getByRole("navigation", { name: "Chapters" });
  await expect(rail.getByRole("link")).toHaveCount(16);
  await page.waitForTimeout(2200);
  await shot(page, "desktop-00-arrive");

  // The rail: click a chapter and it glides there, and stays there while the scenes it passed arrive
  // (14 lies past chapters that flow rather than pin, so they grow mid-glide); then back up to 07.
  await goVia(page, "14 Watch");
  await goVia(page, "07 Similar");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  await walk(page, "desktop");

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) console.log(serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")} — ${v.nodes[0]?.failureSummary?.replace(/\n/g, " ")}`).join("\n"));
  expect(serious.map((v) => v.id)).toEqual([]);

  // Phone: everything flows, nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "Reverie" })).toBeVisible();
  await walk(page, "phone");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);

  // A link straight to a chapter lands on it and stays, while the scenes above it arrive.
  await page.goto("/about#ch-09");
  const top09 = () => page.evaluate(() => Math.abs(document.getElementById("ch-09")!.getBoundingClientRect().top));
  await expect.poll(top09, { timeout: 10_000 }).toBeLessThan(80);
  await page.waitForTimeout(2000);
  expect(await top09()).toBeLessThan(80);

  // Reduced motion: a clean article (no pinning: no chapter is taller than its content needs).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "Reverie" })).toBeVisible();
  for (const [n, name] of [["03", "03 Match"], ["09", "09 Series"], ["11", "11 Timeline"]] as const) {
    await goVia(page, name);
    await settle(page);
    await shot(page, `reduced-${n}`);
  }
  const spacers = await page.locator(".pin-spacer").count();
  expect(spacers).toBe(0);

  // Links in: the nav, the footer, the landing page.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" }).first().getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "About Reverie" })).toBeAttached();
  await expect(page.getByRole("link", { name: "The whole story, chapter by chapter" })).toBeAttached();
  // Phones: the dock has no About, so the top bar carries it, one tap from anywhere.
  await page.setViewportSize({ width: 390, height: 844 });
  const phoneAbout = page.getByRole("banner").getByRole("link", { name: "About", exact: true });
  await expect(phoneAbout).toBeVisible();
  await shot(page, "phone-topbar-about");
  await phoneAbout.click();
  await page.waitForURL((u) => u.pathname === "/about");
  await expect(page.getByRole("banner").getByRole("link", { name: "About", exact: true })).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 1440, height: 900 });

  // The share image.
  const og = await fetch(`${BASE}/api/og/about`);
  expect(og.status).toBe(200);
  expect(og.headers.get("content-type")).toBe("image/png");
  const v = new DataView(await og.arrayBuffer());
  expect([v.getUint32(16), v.getUint32(20)]).toEqual([1200, 630]);
});
