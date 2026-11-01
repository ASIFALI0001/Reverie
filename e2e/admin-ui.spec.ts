import { expect, test, type Page } from "@playwright/test";
import { apiAs, auditFor, createTempUser, deleteTempUser, sampleTitles, setAdmin } from "./helpers/admin";
import { adminSignIn } from "./helpers/session";

const label = process.env.QA_LABEL ?? "admin-ui";
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `.qa/shots/${label}/${name}.png`, fullPage });


test("the control room: overview, users, one user's tabs, block and unblock with re-auth, audit log", async ({ browser }) => {
  test.setTimeout(480_000);
  const admin = await createTempUser("Ada Admin");
  const target = await createTempUser("Tess Target");
  await setAdmin(admin.uid, true);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    // The target has a small library (one title reviewed) and a watchlist.
    const asTarget = await apiAs(target.email, target.password);
    await asTarget("/api/users/bootstrap", { method: "POST" });
    const titles = await sampleTitles(8);
    for (const [i, t] of titles.slice(0, 6).entries()) {
      await asTarget("/api/library", {
        method: "POST",
        body: {
          mediaType: t.mediaType,
          tmdbId: t.tmdbId,
          rating: 6 + (i % 4),
          status: "watched",
          ...(i === 0 ? { worked: ["story", "acting"], didnt: ["long"], note: "Stayed with me for days." } : {}),
        },
      });
    }
    for (const t of titles.slice(6)) await asTarget("/api/watchlist", { method: "POST", body: { mediaType: t.mediaType, tmdbId: t.tmdbId } });

    const page = await context.newPage();
    await adminSignIn(page, admin.email, admin.password);
    await page.waitForURL((u) => u.pathname === "/admin", { timeout: 60_000 });

    // Overview: tiles, the sign-ups line with its table twin, genre bars, top titles.
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    const signups = page.getByRole("region", { name: "Sign-ups" });
    await expect(signups.getByRole("img", { name: /Sign-ups per day/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Genres people save" }).getByRole("listitem").first()).toBeVisible();
    await page.waitForTimeout(1600);
    await shot(page, "overview-desktop", true);
    await signups.getByRole("button", { name: "Table" }).click();
    await expect(signups.getByRole("columnheader", { name: "Day" })).toBeVisible();
    await signups.getByRole("button", { name: "Chart" }).click();

    // Users: server-side search finds the target.
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL((u) => u.pathname === "/admin/users");
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search users" }).fill(target.email);
    await expect(page).toHaveURL(/q=/);
    const row = page.getByRole("link", { name: /Tess Target/ });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("1 matching")).toBeVisible();
    await shot(page, "users-desktop");

    // One user: opening the profile and each private tab is audited.
    await row.click();
    await page.waitForURL((u) => u.pathname === `/admin/users/${target.uid}`);
    await expect(page.getByRole("heading", { level: 1, name: "Tess Target" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(target.uid)).toBeVisible();
    await shot(page, "user-profile-desktop");

    await page.getByRole("tab", { name: "Library" }).click();
    await expect(page.getByText("“Stayed with me for days.”")).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/tab=library/);
    await shot(page, "user-library-desktop", true);
    await page.getByRole("tab", { name: "Watchlist" }).click();
    await expect(page.getByRole("columnheader", { name: "Their match" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("tab", { name: "Taste DNA" }).click();
    await expect(page.getByRole("heading", { name: "Month by month" })).toBeVisible({ timeout: 60_000 });
    await shot(page, "user-taste-desktop", true);
    await page.getByRole("tab", { name: "Friends" }).click();
    await expect(page.getByText("No friends yet.")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByRole("heading", { name: /Recent activity/ })).toBeVisible({ timeout: 30_000 });

    const viewed = (await auditFor(target.uid)).map((e) => e.action);
    for (const a of ["user.view", "user.view.library", "user.view.watchlist", "user.view.taste", "user.view.friends", "user.view.activity"]) {
      expect(viewed).toContain(a);
    }

    // Block, temporarily, showing the reason.
    await page.getByRole("button", { name: "Block…" }).click();
    const dialog = page.getByRole("dialog", { name: "Block Tess Target?" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Reason", { exact: true }).fill("Spamming shared lists");
    await dialog.getByRole("checkbox", { name: /Show them the reason/ }).check();
    await dialog.getByRole("radio", { name: "7 days" }).click();
    await page.waitForTimeout(500);
    await shot(page, "block-dialog-desktop");
    await dialog.getByRole("button", { name: "Block account" }).click();
    await expect(page.getByText("Tess Target is blocked")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status").filter({ hasText: /until/ }).first()).toContainText("Spamming shared lists");
    await expect(asTarget("/api/library")).rejects.toThrow(/blocked/);

    // Unblock. The server asks for a fresh sign-in (forced here): the dialog confirms and retries.
    let forced = false;
    await page.route(`**/api/admin/users/${target.uid}/unblock`, async (route) => {
      if (forced) return route.fallback();
      forced = true;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "reauth_required", message: "Confirm it’s you: sign in again to continue." } }),
      });
    });
    await page.getByRole("button", { name: "Unblock…" }).first().click();
    const unblock = page.getByRole("dialog", { name: "Unblock Tess Target?" });
    await unblock.getByLabel("Why you’re lifting it").fill("Appeal accepted");
    await unblock.getByRole("button", { name: "Unblock account" }).click();
    const confirm = page.getByRole("dialog", { name: "Confirm it’s you" });
    await expect(confirm).toBeVisible();
    await shot(page, "reauth-dialog-desktop");
    await confirm.getByLabel("Your password").fill(admin.password);
    await confirm.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Tess Target is unblocked")).toBeVisible({ timeout: 30_000 });
    expect(forced).toBe(true);
    await expect(asTarget<{ items: unknown[] }>("/api/library")).resolves.toHaveProperty("items");

    // Moderation tab: the history and this account's audit trail.
    await page.getByRole("tab", { name: "Moderation" }).click();
    await expect(page.getByText("Unblocked the account")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("“Appeal accepted”").first()).toBeVisible();
    await shot(page, "user-moderation-desktop", true);

    // The audit log, filtered to blocks.
    await page.getByRole("link", { name: "Audit log" }).click();
    await page.waitForURL((u) => u.pathname === "/admin/audit");
    await page.getByRole("radio", { name: "Blocks" }).click();
    await expect(page.getByText("Blocked the account").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Tess Target" }).first()).toBeVisible();
    await shot(page, "audit-desktop");

    // Phones and tablets still work.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await expect(page.getByRole("img", { name: /Sign-ups per day/ })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1600);
    await shot(page, "overview-mobile", true);
    await page.goto(`/admin/users?q=${encodeURIComponent(target.email)}`);
    await expect(page.getByRole("link", { name: /Tess Target/ })).toBeVisible({ timeout: 30_000 });
    await shot(page, "users-mobile");
    await page.goto(`/admin/users/${target.uid}?tab=library`);
    await expect(page.getByText("“Stayed with me for days.”")).toBeVisible({ timeout: 60_000 });
    await shot(page, "user-library-mobile");

    const log = (await auditFor(target.uid)).map((e) => e.action);
    expect(log.filter((a) => a === "user.block" || a === "user.unblock")).toEqual(["user.unblock", "user.block"]);
  } finally {
    await context.close();
    for (const u of [admin, target]) await deleteTempUser(u.uid);
  }
});
