import { expect, test, type Page } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

/** What sticks out past the right edge of the viewport (empty when the page fits). */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= w) return [];
    return Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").slice(0, 80)}`);
  });
}

test("no page scrolls sideways on a phone", async ({ page }) => {
  test.setTimeout(300_000);
  const ana = await createTempUser("Ana Narrow");
  const ben = await createTempUser("Ben Narrow");
  try {
    const [A, B] = await Promise.all([apiAs(ana.email, ana.password), apiAs(ben.email, ben.password)]);
    const handles: string[] = [];
    for (const call of [A, B]) {
      const { user } = await call<{ user: { handle: string } }>("/api/users/bootstrap", { method: "POST" });
      await call("/api/users/me/handle", { method: "PATCH", body: { handle: user.handle } });
      await call("/api/onboarding", { method: "POST", body: { formats: ["movie"], genres: ["sci-fi"], swipes: [], favourites: [] } });
      for (const tmdbId of [27205, 157336, 603, 24428, 335984]) await call("/api/library", { method: "POST", body: { mediaType: "movie", tmdbId, rating: 9 } });
      handles.push(user.handle);
    }
    const { friendshipId } = await A<{ friendshipId: string }>("/api/friends/requests", { method: "POST", body: { handle: handles[1] } });
    await B(`/api/friends/requests/${friendshipId}`, { method: "PATCH", body: { action: "accept" } });
    await B("/api/users/me", { method: "PATCH", body: { privacy: { friendsSee: "everything" } } });
    const { id } = await A<{ id: string }>("/api/shared-lists", { method: "POST", body: { name: "Narrow night", members: [ben.uid] } });
    await A(`/api/shared-lists/${id}/items`, { method: "POST", body: { mediaType: "movie", tmdbId: 329865 } });

    await page.setViewportSize({ width: 390, height: 844 });
    await signInThroughUi(page, ana.email, ana.password, "/library");
    const pages: [string, () => Promise<void>][] = [
      ["/library", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible()],
      ["/watchlist", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible()],
      ["/friends", () => expect(page.getByRole("link", { name: /^Ben Narrow/ })).toBeVisible({ timeout: 30_000 })],
      [`/u/${handles[1]}`, () => expect(page.getByRole("heading", { level: 1, name: "Ben Narrow" })).toBeVisible({ timeout: 30_000 })],
      [`/u/${handles[1]}/compare`, () => expect(page.getByRole("heading", { level: 1, name: "You and Ben" })).toBeVisible({ timeout: 30_000 })],
      [`/lists/${id}`, () => expect(page.getByRole("heading", { level: 1, name: "Narrow night" })).toBeVisible({ timeout: 30_000 })],
      ["/settings", () => expect(page.getByLabel("Display name")).toBeVisible({ timeout: 30_000 })],
      ["/mood", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 })],
      ["/taste", () => expect(page.getByRole("heading", { level: 1, name: "How your taste has moved" })).toBeVisible({ timeout: 30_000 })],
      ["/taste/wrapped", () => expect(page.getByRole("button", { name: "Next slide" })).toBeVisible({ timeout: 60_000 })],
      ["/title/movie/603-the-matrix", () => expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 })],
    ];
    const problems: string[] = [];
    for (const [path, ready] of pages) {
      await page.goto(path);
      await ready();
      // Let lazy rows and posters arrive: overflow often comes from content that loads late.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(1500);
      const out = await overflow(page);
      if (out.length) problems.push(`${path}: ${out.join(" | ")}`);
    }
    expect(problems).toEqual([]);
  } finally {
    await deleteTempUser(ana.uid);
    await deleteTempUser(ben.uid);
  }
});
