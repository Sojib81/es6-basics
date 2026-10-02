import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a deployed environment — staging by default, never production.
 * Set E2E_BASE_URL to the staging URL (or http://localhost:3000 with `npm run dev` running).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Optional: use a pre-installed Chromium (e.g. cloud dev containers) instead of downloading one.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testIgnore: /admin-settings/ },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] }, testIgnore: /admin-settings/ },
    // Settings tests change shared site-wide state (e.g. prices), so they run alone, after the rest.
    {
      name: "admin-settings",
      use: { ...devices["Pixel 7"] },
      testMatch: /admin-settings/,
      dependencies: ["mobile-chrome", "desktop-chrome"],
    },
  ],
});
