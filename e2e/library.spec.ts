import { expect, test } from "@playwright/test";
import { apiAs, createTempUser, deleteTempUser, sampleTitles } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "p5";

type Entry = { key: string; worked: string[]; didnt: string[]; note: string };

test("library + watchlist: add from title page with a review, shelves, views, watchlist → watched → review", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await createTempUser();
  try {
    await signInThroughUi(page, user.email, user.password, "/title/movie/68721-iron-man-3");
    // New account → onboarding; skip it for this test.
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForURL((u) => u.pathname === "/");
    }

    // ── Add Iron Man 3 from its title page, rated 4/5 ──
    await page.goto("/title/movie/68721-iron-man-3");
    await page.getByRole("button", { name: "Add to library" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /Add Iron Man 3 to your library/ })).toBeVisible();
    const stars = dialog.getByRole("slider", { name: "Your rating" });
    await stars.focus();
    await page.keyboard.press("End"); // 10
    for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowLeft"); // 8 → 4 stars
    await expect(dialog.getByText("8/10")).toBeVisible();
    // What worked, what didn't, and a line in their own words.
    await expect(dialog.getByRole("group", { name: "What worked?" })).toBeVisible();
    for (const chip of ["Dialogue", "Humour", "Weak villain"]) await dialog.getByRole("button", { name: chip, exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Dialogue", exact: true })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByPlaceholder("What stayed with you? A line is plenty.").fill("The banter carries it.");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `.qa/shots/${label}/add-sheet-reactions-desktop.png` });
    await dialog.getByRole("button", { name: "Add to library" }).click();
    await expect(page.getByText("Added Iron Man 3 to your library")).toBeVisible();
    await expect(page.getByRole("button", { name: /Watched/ })).toBeVisible();

    // ── Watchlist Iron Man 2 ──
    await page.goto("/title/movie/10138-iron-man-2");
    await page.getByRole("button", { name: "Watchlist", exact: true }).click();
    await expect(page.getByRole("button", { name: "On your watchlist" })).toBeVisible();

    // A realistic library for the views (through the API, as this user).
    const call = await apiAs(user.email, user.password);
    const [im3] = (await call<{ items: Entry[] }>("/api/library?key=movie:68721")).items;
    expect(im3).toMatchObject({ worked: ["dialogue", "humour"], didnt: ["weak-villain"], note: "The banter carries it." });
    const extra = await sampleTitles(14);
    for (const [i, t] of extra.entries()) {
      await call("/api/library", { method: "POST", body: { mediaType: t.mediaType, tmdbId: t.tmdbId, rating: 4 + (i % 7), status: i % 5 === 0 ? "watching" : "watched" } });
    }

    // ── Library: index, shelves, views ──
    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Your library" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Iron Man 3", exact: false }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `.qa/shots/${label}/library-desktop.png` });

    await page.goto("/library/movies/f-marvel");
    await expect(page.getByRole("heading", { level: 1, name: "Marvel" })).toBeVisible();
    await expect(page.getByText("Iron Man 3").first()).toBeVisible();

    await page.goto("/library/movies");
    await page.getByRole("radio", { name: "Shelf" }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `.qa/shots/${label}/library-shelf-desktop.png` });
    await page.getByRole("radio", { name: "List" }).click();
    await expect(page.getByRole("columnheader", { name: /Your rating/ })).toBeVisible();
    await page.screenshot({ path: `.qa/shots/${label}/library-list-desktop.png` });
    await page.getByRole("radio", { name: "Poster grid" }).click();

    // ── Watchlist: mark watched with a rating, row leaves, library grows ──
    await page.goto("/watchlist");
    await expect(page.getByRole("link", { name: "Iron Man 2" })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `.qa/shots/${label}/watchlist-desktop.png` });
    await page.getByRole("button", { name: "Mark watched" }).click();
    await expect(page.getByText("How was Iron Man 2?")).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `.qa/shots/${label}/watchlist-flip-desktop.png` });
    await page.getByRole("button", { name: /Save without rating|Save to library/ }).click();

    // Then it confirms the move and asks what worked and what didn't.
    const review = page.getByRole("dialog");
    await expect(review.getByRole("heading", { name: "What did you think of Iron Man 2?" })).toBeVisible();
    await expect(review.getByText(/It’s in your library/)).toBeVisible();
    for (const chip of ["Story", "Action"]) await review.getByRole("button", { name: chip, exact: true }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `.qa/shots/${label}/watchlist-review-desktop.png` });
    await review.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. Your next matches will take it into account.")).toBeVisible();
    await expect(page.getByText("Nothing saved for later yet.")).toBeVisible();

    const lib = await call<{ items: Entry[] }>("/api/library");
    expect(lib.items.map((i) => i.key)).toEqual(expect.arrayContaining(["movie:68721", "movie:10138"]));
    expect(lib.items.find((i) => i.key === "movie:10138")).toMatchObject({ worked: ["story", "action"], didnt: [] });

    // Mobile pass.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/library");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `.qa/shots/${label}/library-mobile.png`, fullPage: true });
  } finally {
    await deleteTempUser(user.uid);
  }
});
