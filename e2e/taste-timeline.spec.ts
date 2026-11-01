import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser, idTokenFor } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "taste";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

type Timeline = {
  status: string;
  eras: { start: string; name: string; line: string; genres: { term: string; value: number }[]; count: number; shift: number | null }[];
  series: { genres: string[]; months: { start: string; count: number; shares: number[] | null }[] };
  stats: { titles: number; months: number; hours: number };
  source: "ai" | "facts";
  pending: boolean;
};
type Wrapped = {
  range: { label: string };
  titles: number;
  films: number;
  series: number;
  topGenres: { term: string; share: number }[];
  favourites: { title: string; rating: number }[];
  first: { title: string; at: string } | null;
  busiest: { start: string; count: number } | null;
  eras: { name: string }[];
};

// A dated history in three phases: sci-fi (Jan–Apr), romance and comedy (May–Aug), horror (Sep–Oct).
const PHASES: { months: string[]; ids: number[]; rating: number }[] = [
  { months: ["01", "02", "03", "04"], ids: [157336, 27205, 603, 335984, 329865, 438631, 264660, 137113, 49047, 286217, 17654, 59967], rating: 10 },
  { months: ["05", "06", "07", "08"], ids: [11036, 313369, 4348, 50646, 122906, 509, 19913, 508, 455207, 639, 18240, 4951], rating: 8 },
  { months: ["09", "10"], ids: [493922, 138843, 419430, 346364, 447332, 694, 530385, 458723], rating: 9 },
];

/** Width and height from a PNG's header. */
function pngSize(buf: ArrayBuffer) {
  const v = new DataView(buf);
  return { w: v.getUint32(16), h: v.getUint32(20), png: v.getUint32(0) === 0x89504e47 };
}

test("taste timeline: eras from a dated history, the genre stack, share cards, and Wrapped for any range", async ({ page }) => {
  test.setTimeout(540_000);
  const user = await createTempUser("Tara Timeline");
  try {
    const call = await apiAs(user.email, user.password);
    const { user: me } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
    await call("/api/users/me/handle", { method: "PATCH", body: { handle: me.handle } });
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres: ["sci-fi", "romance", "horror"], swipes: [], favourites: [] } });
    for (const phase of PHASES) {
      const per = phase.ids.length / phase.months.length;
      for (const [k, tmdbId] of phase.ids.entries()) {
        const mm = phase.months[Math.floor(k / per)]!;
        const day = String(3 + (k % per) * 7).padStart(2, "0");
        await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: phase.rating, status: "watched", watchedAt: `2026-${mm}-${day}T20:00:00.000Z` } });
      }
    }
    await new Promise((r) => setTimeout(r, 4000));
    await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 90_000 }).toBe("ready");

    // ── The timeline: three eras, at the turns, each named once.
    let t = await call<Timeline>("/api/taste/timeline");
    for (let k = 0; t.pending && k < 6; k++) {
      await new Promise((r) => setTimeout(r, 5000));
      t = await call<Timeline>("/api/taste/timeline");
    }
    console.log(`eras (${t.source}):\n  ${t.eras.map((e) => `${e.start.slice(0, 7)} ${e.name} — ${e.line} [${e.genres.slice(0, 3).map((g) => `${g.term} ${g.value}`).join(", ")}] shift ${e.shift}`).join("\n  ")}`);
    expect(t.status).toBe("ok");
    expect(t.stats.titles).toBe(32);
    expect(t.stats.months).toBe(10);
    expect(t.eras.map((e) => e.start.slice(0, 7))).toEqual(["2026-01", "2026-05", "2026-09"]);
    expect(t.eras.map((e) => e.count)).toEqual([12, 12, 8]);
    expect(t.eras[0]!.genres.map((g) => g.term)).toContain("Science Fiction");
    expect(t.eras[2]!.genres[0]!.term).toBe("Horror");
    expect(t.eras[0]!.shift).toBeNull();
    for (const e of t.eras.slice(1)) expect(e.shift).toBeGreaterThan(0.5);
    const names = t.eras.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(3);
    for (const e of t.eras) expect(e.line.length).toBeGreaterThan(8);
    expect(t.series.months.length).toBe(10);
    expect(t.series.genres.length).toBeLessThanOrEqual(5);
    for (const m of t.series.months) expect(m.shares!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
    // Named once: asking again gives the same names.
    expect((await call<Timeline>("/api/taste/timeline")).eras.map((e) => e.name)).toEqual(t.eras.map((e) => e.name));

    // ── Wrapped for the year.
    const w = await call<Wrapped>("/api/taste/wrapped?from=2026-01-01&to=2026-12-31");
    console.log(`wrapped: ${w.titles} titles, top ${w.topGenres.map((g) => `${g.term} ${g.share}%`).join(", ")}, first ${w.first?.title}, busiest ${w.busiest?.start.slice(0, 7)} (${w.busiest?.count})`);
    expect(w.range.label).toBe("2026");
    expect(w.titles).toBe(32);
    expect([w.films, w.series]).toEqual([32, 0]);
    expect(w.first?.at.slice(0, 10)).toBe("2026-01-03");
    expect(w.busiest?.count).toBe(4);
    expect(w.favourites.length).toBeGreaterThanOrEqual(3);
    expect(w.favourites[0]!.rating).toBe(10);
    expect(w.eras.length).toBe(3);
    // A range with nothing in it, and one that's backwards.
    expect((await call<Wrapped>("/api/taste/wrapped?from=2025-01-01&to=2025-06-30")).titles).toBe(0);
    await expect(call("/api/taste/wrapped?from=2026-05-01&to=2026-01-01")).rejects.toThrow("before the end");

    // ── Share cards: real PNGs at the promised sizes, private to their owner.
    const token = await idTokenFor(user.email, user.password);
    for (const [format, size] of [
      ["story", { w: 1080, h: 1920 }],
      ["wide", { w: 1200, h: 630 }],
    ] as const) {
      const res = await fetch(`${BASE}/api/taste/card?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(pngSize(await res.arrayBuffer())).toEqual({ ...size, png: true });
    }
    expect((await fetch(`${BASE}/api/taste/card`)).status).toBe(401);

    // ── /taste on a wide screen: DNA, numbers, the eras on a pinned track, the genre stack.
    await signInThroughUi(page, user.email, user.password, "/settings");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/taste");
    await expect(page.getByRole("heading", { level: 1, name: "How your taste has moved" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Titles logged")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1800);
    await shot(page, "taste-hero-desktop");
    // Scroll to the section's top (the pinned track hasn't started), then through it: the radar's
    // caption follows the era in view.
    const eras = page.getByRole("region", { name: "Your eras" });
    const top = await eras.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(1600);
    await expect(eras.getByRole("heading", { level: 3, name: t.eras[0]!.name })).toBeVisible();
    await expect(eras.getByText("Era 1 of 3", { exact: true })).toBeVisible();
    await shot(page, "taste-eras-1-desktop");
    for (const [k, dy] of [700, 1400].entries()) {
      await page.evaluate((y) => window.scrollTo(0, y), top + dy);
      await page.waitForTimeout(1600);
      await expect(eras.getByText(`Era ${k + 2} of 3`, { exact: true })).toBeVisible({ timeout: 10_000 });
      await shot(page, `taste-eras-${k + 2}-desktop`);
    }
    const stack = page.getByRole("group", { name: /^Genre share by month/ });
    await stack.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    // Focus starts on the latest month; two steps back is August (three titles).
    await stack.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("p").filter({ hasText: /^Aug ’26 · 3 titles$/ })).toBeVisible();
    await shot(page, "taste-genres-desktop");
    await page.keyboard.press("Tab");

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
    const serious = axe.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    if (serious.length) console.log(serious.map((x) => `${x.id}: ${x.nodes[0]?.target.join(" ")}`).join("\n"));
    expect(serious.map((x) => x.id)).toEqual([]);

    // The share dialog: both shapes load.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Share your taste" }).click();
    const share = page.getByRole("dialog", { name: "Share your taste" });
    await expect(share.getByRole("img", { name: "Your taste card" })).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => share.getByRole("img", { name: "Your taste card" }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);
    await page.waitForTimeout(600);
    await shot(page, "share-story-desktop");
    await share.getByRole("radio", { name: /^Wide/ }).click();
    await expect.poll(() => share.getByRole("img", { name: "Your taste card" }).evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 60_000 }).toBe(1200);
    await page.waitForTimeout(600);
    await shot(page, "share-wide-desktop");
    await page.keyboard.press("Escape");

    // ── Wrapped: from the button, paused, then through every slide.
    await page.getByRole("link", { name: "Preview Wrapped" }).click();
    await page.waitForURL("**/taste/wrapped");
    await expect(page.getByRole("region", { name: "Your 2026 so far, wrapped" })).toBeVisible({ timeout: 60_000 });
    await page.goto("/taste/wrapped?from=2026-01-01&to=2026-12-31");
    const story = page.getByRole("region", { name: "Your 2026, wrapped" });
    await expect(story).toBeVisible({ timeout: 60_000 });
    await story.getByRole("button", { name: "Pause" }).click();
    await page.waitForTimeout(1200);
    await shot(page, "wrapped-1-desktop");
    const seen: string[] = [];
    for (let k = 0; k < 12; k++) {
      const slide = story.getByRole("group", { name: /^\d+ of \d+: / });
      const name = (await slide.last().getAttribute("aria-label"))!;
      seen.push(name.replace(/^\d+ of \d+: /, ""));
      if (/^(\d+) of \1:/.test(name)) break;
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1100);
      await shot(page, `wrapped-${k + 2}-desktop`);
    }
    console.log(`slides: ${seen.join(" → ")}`);
    expect(seen).toEqual(["Your year in titles", "In numbers", "Where it started", "Your busiest month", "What you watched most", "How it felt", "Your favourites", "Your eras", "Your Taste DNA", "That’s a wrap"]);
    const axe2 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".grain").analyze();
    const serious2 = axe2.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    if (serious2.length) console.log(serious2.map((x) => `${x.id}: ${x.nodes[0]?.target.join(" ")}`).join("\n"));
    expect(serious2.map((x) => x.id)).toEqual([]);
    // Another stretch from the last slide: it re-wraps and the link follows.
    await story.getByRole("button", { name: "Last 12 months" }).click();
    await expect(page.getByRole("region", { name: /^Your \w{3,4} 2025 – \w{3,4} 2026, wrapped$/ })).toBeVisible({ timeout: 60_000 });
    expect(new URL(page.url()).searchParams.get("to")).toBe(new Date().toISOString().slice(0, 10));
    await page.keyboard.press("Escape");
    await page.waitForURL("**/taste");

    // ── Phones: the eras as a list, and Wrapped full screen.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/taste");
    await expect(page.getByRole("heading", { level: 3, name: t.eras[2]!.name })).toBeAttached({ timeout: 60_000 });
    // Scroll through first: counts, radars and the stack animate in view, posters load lazily.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(1500);
    await shot(page, "taste-mobile", true);
    await page.goto("/taste/wrapped?from=2026-01-01&to=2026-12-31");
    await expect(page.getByRole("region", { name: "Your 2026, wrapped" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Pause" }).click();
    for (let k = 0; k < 4; k++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1500);
    await shot(page, "wrapped-genres-mobile");
  } finally {
    await deleteTempUser(user.uid);
  }
});
