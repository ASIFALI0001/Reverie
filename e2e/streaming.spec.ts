import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const label = process.env.QA_LABEL ?? "streaming";
const shot = (page: Page, name: string) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage: true });

// Checks every card, whatever the list holds, so it keeps passing as sites are added to
// app/(site)/streaming/page.tsx, and fails on the usual slip: a logo file name that doesn't exist.
test("streaming sites: every card has a name, a logo that loads and a link that opens in a new tab", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/streaming");
  await expect(page.getByRole("heading", { level: 1, name: "Streaming sites" })).toBeVisible();

  const cards = page.getByRole("main").getByRole("listitem").getByRole("link");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const name = (await card.innerText()).split("\n")[0]!.trim();
    expect(name, `card ${i + 1} has a name`).not.toBe("");
    expect(await card.getAttribute("href"), `${name}: link`).toMatch(/^https:\/\//);
    await expect(card, `${name}: opens in a new tab`).toHaveAttribute("target", "_blank");
    await expect(card, `${name}: no access to Reverie's tab`).toHaveAttribute("rel", /noopener/);
    const logo = card.locator("img");
    await logo.scrollIntoViewIfNeeded();
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { message: `${name}: logo loads` }).toBe(true);
  }

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) console.log(serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`).join("\n"));
  expect(serious.map((v) => v.id)).toEqual([]);
  await shot(page, "streaming-desktop");

  // Phone: two to a row, nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await shot(page, "streaming-mobile");

  // Reachable from every footer.
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Streaming sites" })).toHaveAttribute("href", "/streaming");
});
