import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "should-continue";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

type Verdict = {
  verdict: "keep" | "try" | "stop";
  tryUntil: { season: number; episode: number } | null;
  confidence: number;
  reasons: string[];
  source: "ai" | "facts";
  position: { season: number; episode: number };
  chart: { season: number; avg: number | null; episodes: { episode: number; rating: number | null }[] }[];
};

const BREAKING_BAD = 1396;
// People who only turn up after season 1, episode 2: naming any of them is a spoiler there.
const LATER_ONLY = /\b(tuco|saul|goodman|gus|gustavo|fring|mike|ehrmantraut|hector|salamanca|todd|lydia|gale|jane|heisenberg)\b/i;
const EVENTS = /\b(dies|died|death|killed|kills|murder\w*|betray\w*)\b/i;

test("should I keep going: a spoiler-free verdict from where you are, the ratings ahead, and your decision as a library status", async ({ page }) => {
  test.setTimeout(420_000);
  const user = await createTempUser("Walt Watcher");
  try {
    const call = await apiAs(user.email, user.password);
    const { user: me } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
    await call("/api/users/me/handle", { method: "PATCH", body: { handle: me.handle } });
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie", "series"], genres: ["crime", "thriller", "drama"], swipes: [], favourites: [] } });
    for (const [mediaType, tmdbId, rating] of [
      ["tv", 1438, 10], // The Wire
      ["tv", 60059, 9], // Better Call Saul
      ["movie", 680, 9], // Pulp Fiction
    ] as const) {
      await call("/api/library", { method: "POST", body: { mediaType, tmdbId, rating, status: "watched" } });
    }
    await call("/api/library", { method: "POST", body: { mediaType: "tv", tmdbId: BREAKING_BAD, status: "watching" } });
    // Verdicts are cached per taste version: let the profile rebuild from the setup land first.
    for (let last = -1, k = 0; k < 30; k++) {
      const t = await call<{ status: string; version: number }>("/api/taste");
      if (t.status === "ready" && t.version === last) break;
      last = t.version;
      await new Promise((r) => setTimeout(r, 3000));
    }

    // The picker: real seasons, and nothing remembered yet.
    const before = await call<{ seasons: { season: number; episodes: number }[]; progress: unknown; status: string }>(`/api/series/${BREAKING_BAD}/seasons`);
    expect(before.seasons.map((s) => s.season)).toEqual([1, 2, 3, 4, 5]);
    expect(before.progress).toBeNull();
    expect(before.status).toBe("watching");

    // Episodes that don't exist are refused.
    await expect(call(`/api/series/${BREAKING_BAD}/should-continue`, { method: "POST", body: { season: 1, episode: 40 } })).rejects.toThrow("don’t exist");

    // The verdict at S1E2, with what's bothering them.
    const v = await call<Verdict>(`/api/series/${BREAKING_BAD}/should-continue`, { method: "POST", body: { season: 1, episode: 2, reason: "Too slow" } });
    console.log(`verdict (${v.source}): ${v.verdict}${v.tryUntil ? ` till S${v.tryUntil.season}E${v.tryUntil.episode}` : ""} · ${v.confidence}\n  - ${v.reasons.join("\n  - ")}`);
    expect(["keep", "try", "stop"]).toContain(v.verdict);
    expect(v.confidence).toBeGreaterThanOrEqual(0);
    expect(v.confidence).toBeLessThanOrEqual(1);
    expect(v.reasons.length).toBeGreaterThanOrEqual(2);
    expect(v.reasons.length).toBeLessThanOrEqual(3);
    for (const r of v.reasons) {
      expect(r, `spoils a later character: ${r}`).not.toMatch(LATER_ONLY);
      expect(r, `spoils an event: ${r}`).not.toMatch(EVENTS);
    }
    if (v.tryUntil) expect(v.tryUntil.season * 100 + v.tryUntil.episode).toBeGreaterThan(102);
    expect(v.position).toEqual({ season: 1, episode: 2 });
    expect(v.chart.map((c) => c.season)).toEqual([1, 2, 3, 4, 5]);
    expect(v.chart[0]!.episodes.length).toBe(7);
    // Where they are went back into the library.
    expect((await call<{ progress: unknown }>(`/api/series/${BREAKING_BAD}/seasons`)).progress).toEqual({ season: 1, episode: 2 });
    // The model's answer is cached: asking the same thing again returns it unchanged.
    if (v.source === "ai") {
      const again = await call<Verdict>(`/api/series/${BREAKING_BAD}/should-continue`, { method: "POST", body: { season: 1, episode: 2, reason: "Too slow" } });
      expect(again.reasons).toEqual(v.reasons);
    }

    // Deciding to stop files it as Dropped, at that episode.
    const stopped = await call<{ status: string }>(`/api/series/${BREAKING_BAD}/decision`, { method: "POST", body: { decision: "stopped", season: 1, episode: 2, verdict: v.verdict } });
    expect(stopped.status).toBe("dropped");
    const lib = await call<{ items: { status: string; progress?: { season: number; episode: number } }[] }>(`/api/library?key=tv:${BREAKING_BAD}`);
    expect(lib.items[0]?.status).toBe("dropped");

    // ── The UI, from the series page: prefilled from the library, a stamped verdict, the chart.
    await signInThroughUi(page, user.email, user.password, "/settings");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/title/tv/${BREAKING_BAD}-breaking-bad`);
    const ask = page.getByRole("button", { name: "Should I keep going?" });
    await expect(ask).toBeVisible({ timeout: 30_000 });
    await ask.click();
    const sheet = page.getByRole("dialog", { name: "Should I keep going?" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Where are you? (from your library)")).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByLabel("Season")).toHaveValue("1");
    await expect(sheet.getByLabel("Episode you’ve just watched")).toHaveValue("2");
    await sheet.getByRole("button", { name: "Too slow" }).click();
    await expect(sheet.getByRole("button", { name: "Too slow" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(600);
    await shot(page, "sheet-ask-desktop");
    // The decision above changed their library (so their taste version), so this is a fresh answer.
    await sheet.getByRole("button", { name: "Ask Reverie" }).click();
    await expect(sheet.getByText(/^(Keep going|Probably stop here|Give it till S\d+E\d+|Give it a little longer)$/)).toBeVisible({ timeout: 90_000 });
    await expect(sheet.getByText("Spoiler shield", { exact: true })).toBeVisible();
    const shown = await sheet.getByRole("listitem").allInnerTexts();
    console.log(`in the sheet:\n  - ${shown.join("\n  - ")}`);
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(shown.length).toBeLessThanOrEqual(3);
    for (const r of shown) expect(r).not.toMatch(LATER_ONLY);
    await expect(sheet.locator("svg").getByText("You are here")).toBeAttached();
    // A dot's readout on keyboard focus.
    await sheet.getByRole("img", { name: /^Season 2, episode 1: rated [\d.]+, still ahead$/ }).focus();
    await expect(sheet.getByText(/^S2E1 · [\d.]+$/)).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, "sheet-verdict-desktop");

    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = axe.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
    if (serious.length) console.log(serious.map((x) => `${x.id}: ${x.nodes[0]?.target.join(" ")}`).join("\n"));
    expect(serious.map((x) => x.id)).toEqual([]);

    // Keep going after all: Watching, and the sheet closes.
    await sheet.getByRole("button", { name: "I’ll keep going" }).click();
    await expect(page.getByText("Watching it is")).toBeVisible({ timeout: 30_000 });
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await call<{ items: { status: string }[] }>(`/api/library?key=tv:${BREAKING_BAD}`)).items[0]?.status, { timeout: 30_000 }).toBe("watching");

    // ── From the library: the item menu offers it for a series you're watching.
    await page.goto("/library/series");
    await page.getByRole("button", { name: "Options for Breaking Bad" }).click();
    await page.getByRole("menuitem", { name: "Should I keep going?" }).click();
    await expect(page.getByRole("dialog", { name: "Should I keep going?" })).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Episode you’ve just watched")).toHaveValue("2", { timeout: 30_000 });
    await page.keyboard.press("Escape");
    // A finished series doesn't offer it.
    await page.getByRole("button", { name: "Options for The Wire" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit details" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Should I keep going?" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // ── Phone: the sheet comes up from the bottom.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/title/tv/${BREAKING_BAD}-breaking-bad`);
    await page.getByRole("button", { name: "Should I keep going?" }).click();
    const phone = page.getByRole("dialog", { name: "Should I keep going?" });
    await expect(phone.getByLabel("Episode you’ve just watched")).toHaveValue("2", { timeout: 30_000 });
    await phone.getByRole("button", { name: "Too slow" }).click();
    await phone.getByRole("button", { name: "Ask Reverie" }).click();
    await expect(phone.getByText("Spoiler shield", { exact: true })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
    await shot(page, "sheet-verdict-mobile");
  } finally {
    await deleteTempUser(user.uid);
  }
});
