import { defineConfig } from "@playwright/test";
import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_VERSION } from "./lib/legal";
import { MUSIC_PREF_KEY } from "./lib/music";

const baseURL = process.env.E2E_BASE ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 860 },
    // Every browser starts as someone who has already seen the cookie notice (so it never covers what a
    // test clicks or shoots) and has the background music muted (so no test downloads or plays it).
    // e2e/legal.spec.ts and e2e/music.spec.ts open fresh browsers to test those two themselves.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            { name: COOKIE_NOTICE_KEY, value: COOKIE_NOTICE_VERSION },
            { name: MUSIC_PREF_KEY, value: "off" },
          ],
        },
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
