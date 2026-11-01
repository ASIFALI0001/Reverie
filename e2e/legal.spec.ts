import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_VERSION } from "../lib/legal";

const label = process.env.QA_LABEL ?? "legal";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

async function axeClean(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) console.log(serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")} — ${v.nodes[0]?.failureSummary?.replace(/\n/g, " ")}`).join("\n"));
  expect(serious.map((v) => v.id)).toEqual([]);
}

const DOCS = [
  { path: "/terms", title: "Terms of Service", says: ["The agreement", "Governing law", "YouTube Terms of Service"] },
  { path: "/privacy", title: "Privacy Policy", says: ["What we collect", "Administrators", "Google Privacy Policy"] },
  { path: "/cookies", title: "Cookie Policy", says: ["rv_session", "reverie-theme", "What we don’t use"] },
];

test("legal: terms, privacy and cookie policies, linked from each other, the footer and sign-up", async ({ page }) => {
  for (const d of DOCS) {
    await page.goto(d.path);
    await expect(page.getByRole("heading", { level: 1, name: d.title })).toBeVisible();
    await expect(page.getByText(/^Last updated /)).toBeVisible();
    for (const words of d.says) await expect(page.getByText(words).first()).toBeVisible();
    // The other two are a link away; this one is marked as the current page.
    const legal = page.getByRole("navigation", { name: "Legal" });
    await expect(legal.getByRole("link")).toHaveCount(2);
    await expect(legal.locator('[aria-current="page"]')).toHaveText(d.title);
    await axeClean(page);
    await shot(page, `${d.path.slice(1)}-desktop`, true);
  }

  // Phone: the cookie tables fit the screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cookies");
  await expect(page.getByRole("table", { name: "Cookies Reverie sets" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await shot(page, "cookies-mobile", true);

  // Every page's footer links to all three.
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const [name, href] of [
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Cookies", "/cookies"],
  ] as const) {
    await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }

  // Signing up says what you're agreeing to.
  await page.goto("/signup");
  await expect(page.getByText("By creating an account, you agree to")).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
});

test("cookie notice: a first visit sees it once; dismissed, it stays away", async ({ browser }) => {
  // A browser that has never been here (everywhere else, the config starts with the notice already seen).
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  const notice = page.getByRole("region", { name: "Cookies" });
  await expect(notice).toBeVisible({ timeout: 10_000 });
  await expect(notice).toContainText("No ads, no tracking");
  await expect(notice.getByRole("link", { name: "Cookie policy" })).toHaveAttribute("href", "/cookies");
  await page.waitForTimeout(800);
  await axeClean(page);
  await shot(page, "notice-desktop");

  // Phone: it sits above the dock, never over it.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const box = (await notice.boundingBox())!;
  // The dock is the last "Primary" navigation on the page (after the top bar's).
  const dock = (await page.getByRole("navigation", { name: "Primary" }).last().boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
  await shot(page, "notice-mobile");

  await notice.getByRole("button", { name: "Got it" }).click();
  await expect(notice).toBeHidden();
  expect(await page.evaluate((k) => localStorage.getItem(k), COOKIE_NOTICE_KEY)).toBe(COOKIE_NOTICE_VERSION);
  // Gone for good: after a reload and on another page.
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(notice).toBeHidden();
  await page.goto("/about");
  await page.waitForTimeout(2500);
  await expect(notice).toBeHidden();
  await context.close();
});
