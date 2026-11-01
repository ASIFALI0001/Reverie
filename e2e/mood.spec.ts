import { expect, test, type Page } from "@playwright/test";
import mongoose from "mongoose";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "mood";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });

type Pick = { key: string; card: { mediaType: string; runtime: number | null; title: string }; reason: string; match: number | null; streaming: { name: string }[] };
type Result = { sessionId: string; label: string; picks: Pick[]; servicesMissing: boolean };

const LOVED = [27205, 157336, 603, 76341, 155];

async function sessionsFor(uid: string) {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    return (await conn.db!.collection("moodSessions").find({ uid }).sort({ createdAt: 1 }).toArray()) as unknown as {
      mood: { preset: string | null; text: string | null };
      picks: { key: string }[];
      swapped: string[];
      chosenKey: string | null;
    }[];
  } finally {
    await conn.close();
  }
}

test("mood search: presets, free text, comfort rewatch, time limits, swaps, sessions, services, and the flow", async ({ page }) => {
  test.setTimeout(480_000);
  const user = await createTempUser("Mo Odd");
  try {
    const call = await apiAs(user.email, user.password);
    const { user: me } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
    await call("/api/users/me/handle", { method: "PATCH", body: { handle: me.handle } });
    await call("/api/users/me", { method: "PATCH", body: { invitePromptSeen: true } });
    await call("/api/onboarding", { method: "POST", body: { formats: ["movie", "series"], genres: ["sci-fi", "thriller"], swipes: [], favourites: [] } });
    for (const tmdbId of LOVED) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 10 } });
    await new Promise((r) => setTimeout(r, 4000));
    await expect.poll(async () => (await call<{ status: string }>("/api/taste")).status, { timeout: 60_000 }).toBe("ready");

    const options = await call<{ presets: unknown[]; times: unknown[]; servicesCount: number }>("/api/mood");
    expect(options.presets).toHaveLength(10);
    expect(options.times).toHaveLength(4);

    // A preset: films of 70–115 minutes they haven't seen, each with a line.
    const seat = await call<Result>("/api/mood/pick", { method: "POST", body: { preset: "edge-of-seat", time: "film", company: "alone" } });
    console.log(`edge of my seat, ~90 min: ${seat.picks.map((p) => `${p.card.title} (${p.card.runtime}m, ${p.match}%) — ${p.reason}`).join(" | ")}`);
    expect(seat.picks.length).toBe(3);
    for (const p of seat.picks) {
      expect(p.card.mediaType).toBe("movie");
      expect(p.card.runtime!).toBeGreaterThanOrEqual(70);
      expect(p.card.runtime!).toBeLessThanOrEqual(115);
      expect(p.reason.length).toBeGreaterThan(5);
      expect(LOVED.map((id) => `movie:${id}`)).not.toContain(p.key);
    }
    expect(new Set(seat.picks.map((p) => p.key)).size).toBe(3);

    // "Not this": a different title comes in, and the session remembers what was swapped.
    const { pick: next } = await call<{ pick: Pick | null }>("/api/mood/pick/swap", { method: "POST", body: { sessionId: seat.sessionId, key: seat.picks[0]!.key } });
    if (next) expect(seat.picks.map((p) => p.key)).not.toContain(next.key);
    await call("/api/mood/pick/choose", { method: "POST", body: { sessionId: seat.sessionId, key: seat.picks[1]!.key } });
    const [session] = await sessionsFor(user.uid);
    expect(session).toMatchObject({ mood: { preset: "edge-of-seat" }, swapped: [seat.picks[0]!.key], chosenKey: seat.picks[1]!.key });

    // Free text, short on time: episodes of 35 minutes or less.
    const cosy = await call<Result>("/api/mood/pick", { method: "POST", body: { text: "something cosy and gentle for a rainy evening", time: "short" } });
    console.log(`cosy, <30 min: ${cosy.picks.map((p) => `${p.card.title} (${p.card.runtime}m)`).join(" | ")}`);
    for (const p of cosy.picks) {
      expect(p.card.mediaType).toBe("tv");
      expect(p.card.runtime ?? 0).toBeLessThanOrEqual(35);
    }

    // Comfort rewatch draws on what they loved.
    const comfort = await call<Result>("/api/mood/pick", { method: "POST", body: { preset: "comfort-rewatch", time: "long" } });
    expect(comfort.picks.length).toBeGreaterThan(0);
    for (const p of comfort.picks) expect(LOVED.map((id) => `movie:${id}`)).toContain(p.key);

    // "Only my services": without any picked, it says so; with some, the picks stream on them.
    expect((await call<Result>("/api/mood/pick", { method: "POST", body: { preset: "light-fun", time: "film", onlyMyServices: true } })).servicesMissing).toBe(true);
    const { services } = await call<{ services: { id: number; name: string }[] }>("/api/services");
    expect(services.length).toBeGreaterThan(3);
    const mine = services.slice(0, 4);
    await call("/api/users/me", { method: "PATCH", body: { services: mine.map((s) => s.id) } });
    const onMine = await call<Result>("/api/mood/pick", { method: "POST", body: { preset: "light-fun", time: "film", onlyMyServices: true } });
    expect(onMine.servicesMissing).toBe(false);
    for (const p of onMine.picks) expect(mine.map((s) => s.name)).toContain(p.streaming[0]?.name);

    // The flow: tiles → time → company → three cards, one swapped.
    await signInThroughUi(page, user.email, user.password, "/mood");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/mood");
    await expect(page.getByRole("heading", { level: 1, name: "What’s your mood tonight?" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Edge of my seat/ })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, "mood-tiles-desktop");
    await page.getByRole("button", { name: /Edge of my seat/ }).click();
    await expect(page.getByRole("heading", { name: "How long have you got?" })).toBeVisible();
    await page.getByRole("radio", { name: /About 90 minutes/ }).click();
    await shot(page, "mood-time-desktop");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "Just me" }).click();
    await shot(page, "mood-company-desktop");
    await page.getByRole("button", { name: "Show me three" }).click();
    await expect(page.getByRole("heading", { name: /For “Edge of my seat”/ })).toBeVisible({ timeout: 90_000 });
    const notThis = page.getByRole("button", { name: /^Not this: show another instead of / });
    await expect(notThis).toHaveCount(3, { timeout: 30_000 });
    await page.waitForTimeout(2200);
    await shot(page, "mood-results-desktop", true);
    const firstTitle = ((await notThis.first().getAttribute("aria-label")) ?? "").replace(/^Not this: show another instead of /, "");
    await notThis.first().click();
    await expect(page.getByRole("button", { name: `Not this: show another instead of ${firstTitle}` })).toHaveCount(0, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, "mood-swapped-desktop");

    // Phones.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mood");
    await expect(page.getByRole("button", { name: /Scare me/ })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, "mood-tiles-mobile", true);

    // Entry points: Home's card (a chip goes straight to the time step), and Settings → My services.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const card = page.getByRole("heading", { name: "Not sure what to watch? Tell me your mood." });
    await card.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await page.waitForTimeout(900);
    await shot(page, "home-mood-card-desktop");
    await page.getByRole("link", { name: "Make me think" }).click();
    await expect(page.getByRole("heading", { name: "How long have you got?" })).toBeVisible({ timeout: 30_000 });
    await page.goto("/settings#services");
    await expect(page.getByRole("heading", { name: "My services" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: mine[0]!.name, pressed: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("heading", { name: "My services" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, "settings-services-desktop");
  } finally {
    await deleteTempUser(user.uid);
  }
});
