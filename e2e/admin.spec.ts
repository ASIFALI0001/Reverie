import { expect, test, type Page } from "@playwright/test";
import { apiAs, auditFor, createTempUser, deleteTempUser, setAdmin } from "./helpers/admin";
import { adminSignIn, signInThroughUi } from "./helpers/session";

const label = process.env.QA_LABEL ?? "admin";
const shot = (page: Page, name: string) => page.screenshot({ path: `.qa/shots/${label}/${name}.png` });

test("non-admins can't reach the admin area or its API", async ({ page }) => {
  const user = await createTempUser("Plain Viewer");
  try {
    const call = await apiAs(user.email, user.password);
    await expect(call("/api/admin/me")).rejects.toThrow(/administrators/);
    await expect(call(`/api/admin/users/${user.uid}/block`, { method: "POST", body: { reason: "testing the guard" } })).rejects.toThrow(/administrators/);

    // Signed out: /admin sends you to the admin sign-in.
    await page.goto("/admin");
    await page.waitForURL((u) => u.pathname === "/admin/login");
    await shot(page, "admin-login-desktop");

    // A real account without the role is turned away.
    await adminSignIn(page, user.email, user.password);
    await expect(page.getByText("This account isn’t an administrator.")).toBeVisible();
    await shot(page, "admin-login-denied-desktop");
  } finally {
    await deleteTempUser(user.uid);
  }
});

test("an admin blocks a user, who lands on /blocked; unblocking restores access", async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await createTempUser("Ada Admin");
  const otherAdmin = await createTempUser("Grace Admin");
  const target = await createTempUser("Target Viewer");
  await setAdmin(admin.uid, true);
  await setAdmin(otherAdmin.uid, true);
  const viewer = await browser.newContext();
  const control = await browser.newContext();
  try {
    // The target has a live session in their own browser.
    const page = await viewer.newPage();
    await signInThroughUi(page, target.email, target.password, "/library");

    // The admin signs in to the control room.
    const adminPage = await control.newPage();
    await adminSignIn(adminPage, admin.email, admin.password);
    await adminPage.waitForURL((u) => u.pathname === "/admin");
    await expect(adminPage.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await shot(adminPage, "admin-shell-desktop");

    const asAdmin = await apiAs(admin.email, admin.password);
    // Guard rails: not yourself, not another admin.
    await expect(asAdmin(`/api/admin/users/${admin.uid}/block`, { method: "POST", body: { reason: "testing self block" } })).rejects.toThrow(/own account/);
    await expect(asAdmin(`/api/admin/users/${otherAdmin.uid}/block`, { method: "POST", body: { reason: "testing admin block" } })).rejects.toThrow(
      /Administrators can’t be blocked/,
    );

    const until = new Date(Date.now() + 10 * 86_400_000).toISOString();
    await asAdmin(`/api/admin/users/${target.uid}/block`, { method: "POST", body: { reason: "Spamming shared lists", showReason: true, until } });

    // Their sessions were revoked: the open tab is signed out…
    await page.goto("/library");
    await page.waitForURL((u) => u.pathname === "/signin", { timeout: 30_000 });
    // …and signing in again lands on /blocked, with the reason the admin chose to show.
    await page.getByLabel("Email").fill(target.email);
    await page.getByLabel("Password", { exact: true }).fill(target.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/blocked", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /blocked by an administrator/ })).toBeVisible();
    await expect(page.getByText("Spamming shared lists")).toBeVisible();
    await expect(page.getByText(/You can return after/)).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "blocked-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "blocked-mobile");

    // Signing in again works (the account isn't disabled), but the API refuses everything.
    const asTarget = await apiAs(target.email, target.password);
    await expect(asTarget("/api/library")).rejects.toThrow(/blocked/);
    await expect(asTarget<{ blocked: boolean; reason: string }>("/api/users/me/status")).resolves.toMatchObject({ blocked: true, reason: "Spamming shared lists" });

    await asAdmin(`/api/admin/users/${target.uid}/unblock`, { method: "POST", body: { reason: "Appeal accepted" } });
    await expect(asTarget<{ items: unknown[] }>("/api/library")).resolves.toHaveProperty("items");

    const log = await auditFor(target.uid);
    expect(log.map((e) => e.action)).toEqual(["user.unblock", "user.block"]);
    expect(log.every((e) => e.adminUid === admin.uid)).toBe(true);
  } finally {
    await viewer.close();
    await control.close();
    for (const u of [admin, otherAdmin, target]) await deleteTempUser(u.uid);
  }
});
