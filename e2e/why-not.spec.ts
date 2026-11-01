import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser, tasteSignals } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "why-not";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

type WhyNot = {
  status: string;
  negatives: { reason: string; evidence: { key: string; title: string }[] }[];
  positive: string | null;
  source: "ai" | "facts";
  feedback: boolean | null;
};

// Loves sci-fi and action; turned away from romantic dramas.
const LOVED = [27205, 157336, 603, 76341, 155];
const DISLIKED: [number, number | null][] = [
  [11036, 3], // The Notebook
  [4348, 4], // Pride & Prejudice
  [313369, null], // La La Land, dropped
];
const TITANIC = 597;

test("why not: honest reasons from your own history, evidence posters, feedback as a weak signal, and the list popover", async ({ page }) => {
  test.setTimeout(300_000);
  const user = await createTempUser("Rhea Honest");
  try {
    const call = await apiAs(user.email, user.password);
    const { user: me } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
    await call("/api/users/me/handle", { method: "PATCH", body: { handle: me.handle } });
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres: ["sci-fi", "action"], pace: 0.75, tone: 0.55, swipes: [], favourites: [] } });
    for (const tmdbId of LOVED) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 10 } });
    for (const [tmdbId, rating] of DISLIKED) {
      await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, ...(rating ? { rating, status: "watched" } : { status: "dropped" }) } });
    }
    await new Promise((r) => setTimeout(r, 4000));
    await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 60_000 }).toBe("ready");

    // A low match for Titanic, and an honest why-not resting only on titles from their own library.
    const match = await call<{ status: string; score: number }>(`/api/match/movie/${TITANIC}`);
    console.log(`Titanic match: ${match.score}%`);
    expect(match.score).toBeLessThan(70);
    const why = await call<WhyNot>(`/api/match/movie/${TITANIC}/why-not`);
    console.log(`why-not (${why.source}):\n  - ${why.negatives.map((n) => `${n.reason} [${n.evidence.map((e) => e.title).join(", ")}]`).join("\n  - ")}\n  + ${why.positive}`);
    expect(why.status).toBe("ok");
    expect(why.negatives.length).toBeGreaterThanOrEqual(1);
    expect(why.negatives.length).toBeLessThanOrEqual(3);
    const library = new Set([...LOVED, ...DISLIKED.map(([id]) => id)].map((id) => `movie:${id}`));
    for (const n of why.negatives) {
      expect(n.reason.replace(/…$/, "").split(/\s+/).length).toBeLessThanOrEqual(18);
      for (const e of n.evidence) expect(library.has(e.key)).toBe(true);
    }
    // Evidence is what they didn't enjoy, never what they loved.
    const cited = why.negatives.flatMap((n) => n.evidence.map((e) => e.key));
    for (const id of LOVED) expect(cited).not.toContain(`movie:${id}`);
    // The model's answer is cached with the match: asking again returns the same explanation.
    if (why.source === "ai") expect((await call<WhyNot>(`/api/match/movie/${TITANIC}/why-not`)).negatives).toEqual(why.negatives);
    // The quick form (list popovers) never waits for the model.
    const quick = await call<WhyNot>(`/api/match/movie/${TITANIC}/why-not?quick=1`);
    expect(quick.negatives.length).toBeGreaterThanOrEqual(1);

    // The title page: the section, the evidence posters, and "Was this right?".
    await signInThroughUi(page, user.email, user.password, "/");
    await page.goto(`/title/movie/${TITANIC}-titanic`);
    const heading = page.getByRole("heading", { name: "Why it might not be for you" });
    await heading.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await expect(heading).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Was this right?")).toBeVisible({ timeout: 60_000 });
    if (cited.length) await expect(page.getByRole("link", { name: /^Based on / }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, "title-why-not-desktop");
    await page.getByRole("button", { name: "Yes, that sounds like me" }).click();
    await expect(page.getByText("Thanks. Reverie will count that, lightly.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, that sounds like me" })).toHaveAttribute("aria-pressed", "true");
    await shot(page, "title-why-not-answered-desktop");

    // Saved, and folded into the taste profile as a whisper of a signal.
    expect((await call<WhyNot>(`/api/match/movie/${TITANIC}/why-not`)).feedback).toBe(true);
    await expect
      .poll(async () => (await tasteSignals(user.uid)).find((s) => s.key === `movie:${TITANIC}`), { timeout: 60_000 })
      .toMatchObject({ source: "feedback", type: "disliked" });
    const signal = (await tasteSignals(user.uid)).find((s) => s.key === `movie:${TITANIC}`)!;
    expect(signal.weight).toBeLessThan(0);
    expect(signal.weight).toBeGreaterThan(-0.25);

    // Phones.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await heading.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await shot(page, "title-why-not-mobile");

    // Lists: a low-match card in "More like this" offers a quiet "Why?".
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/title/movie/${TITANIC}-titanic`);
    for (let i = 1; i <= 6; i++) {
      await page.evaluate((f) => window.scrollTo(0, document.documentElement.scrollHeight * f), i / 6);
      await page.waitForTimeout(400);
    }
    const rail = page.getByRole("list", { name: "More like this" });
    await expect(rail.locator("li").first()).toBeVisible({ timeout: 60_000 });
    const trigger = rail.getByRole("button", { name: /^Why might .+ not be for you\?$/ }).first();
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const popover = page.getByRole("dialog");
    await expect(popover.getByRole("link", { name: "The full picture" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "list-why-popover-desktop");
  } finally {
    await deleteTempUser(user.uid);
  }
});
