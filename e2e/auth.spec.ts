import { expect, test } from "@playwright/test";
import { deleteFirebaseUser, firebaseUidFor, mongoUserExists } from "./helpers/admin";
import { autoKeepHandle } from "./helpers/session";

const email = `qa+${Date.now()}@reverie.test`;
const password = "projector-lamp-42";
const isRoot = (url: URL) => url.pathname === "/";

test.afterAll(async () => {
  // Safety net if the flow failed before deleting its own account.
  await deleteFirebaseUser(email);
});

test("email account lifecycle: sign up → onboarding → home → settings → sign out → sign in → delete", async ({ page }) => {
  await autoKeepHandle(page);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  // New users land in onboarding.
  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: /learn your taste/i })).toBeVisible();
  const uid = await firebaseUidFor(email);
  expect(uid).toBeTruthy();
  expect(await mongoUserExists(uid!)).toBe(true);

  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL(isRoot);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada");

  // Settings: rename + region.
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Ada L.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await page.getByLabel("Region").selectOption("US");
  await expect(page.getByText("Region updated")).toBeVisible();

  // Sign out → protected pages bounce to sign-in with a return path.
  await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(isRoot);
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.goto("/settings");
  await page.waitForURL(/\/signin\?next=%2Fsettings/);
  // Wrong password → friendly error, no account hint.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // (Scoped to <main>: Next's route announcer is also role="alert".)
  await expect(page.getByRole("main").getByRole("alert")).toContainText("don’t match");

  // Right password → back to where they were going.
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/settings");
  await expect(page.getByLabel("Display name")).toHaveValue("Ada L.");

  // Delete (re-auth with password) → everything gone.
  await page.getByRole("button", { name: "Delete account…" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByLabel("Your password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL(isRoot);
  await expect(page.getByText("Your account was deleted")).toBeVisible();
  expect(await firebaseUidFor(email)).toBeNull();
  expect(await mongoUserExists(uid!)).toBe(false);
});

test("forgot password answers the same way whether or not the account exists", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(`nobody+${Date.now()}@reverie.test`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
  await expect(page.getByText("If an account exists for")).toBeVisible();
});

test("Google sign-in opens Google's account chooser", async ({ page }) => {
  await page.goto("/signin");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect.poll(() => popup.url(), { timeout: 20_000 }).toMatch(/accounts\.google\.com|firebaseapp\.com\/__\/auth/);
  await popup.close();
});
