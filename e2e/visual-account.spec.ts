import { expect, test } from "@playwright/test";
import { createTempUser, deleteTempUser } from "./helpers/admin";
import { signInThroughUi } from "./helpers/session";

// Design QA for signed-in screens: screenshots land in .qa/shots/<label>/.
const label = process.env.QA_LABEL ?? "signed-in";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

test("signed-in screens render (settings, home, account menu) @visual", async ({ page }) => {
  const user = await createTempUser();
  try {
    await signInThroughUi(page, user.email, user.password);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/settings");
      await expect(page.getByLabel("Display name")).toHaveValue("Ada Lovelace");
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `.qa/shots/${label}/settings-${vp.name}.png`, fullPage: true });

      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada");
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `.qa/shots/${label}/home-${vp.name}.png` });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Your account" }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `.qa/shots/${label}/account-menu-desktop.png` });
  } finally {
    await deleteTempUser(user.uid);
  }
});
