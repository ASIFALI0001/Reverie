import type { Page } from "@playwright/test";

/**
 * The one-time "Pick your handle" dialog opens over whatever page an onboarded account visits
 * first. Tests that aren't about it keep the suggested handle whenever it appears.
 */
export async function autoKeepHandle(page: Page) {
  await page.addLocatorHandler(page.getByRole("dialog", { name: "Pick your handle" }), async (dialog) => {
    await dialog.getByRole("button", { name: /^Keep @/ }).click();
  });
}

/** Sign in through the real UI and wait until the session cookie is set. */
export async function signInThroughUi(page: Page, email: string, password: string, next = "/settings", { handlePrompt = "keep" }: { handlePrompt?: "keep" | "show" } = {}) {
  if (handlePrompt === "keep") await autoKeepHandle(page);
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // New accounts are routed through onboarding first; either destination means the session exists.
  await page.waitForURL((url) => url.pathname === next || url.pathname === "/onboarding");
}

/** Sign in at /admin/login (no wait: callers check where it lands). */
export async function adminSignIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
