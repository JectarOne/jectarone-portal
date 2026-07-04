import { defineConfig, devices } from "@playwright/test";

// E2E covers the PUBLIC auth pages (/login, /signup), which render without a
// database. Authenticated dashboard flows need a live Postgres + seed data and
// are validated separately (see README "Testing").
const PORT = 3210;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Dummy values so the app boots; the auth pages never query the DB on render.
      AUTH_SECRET: "test-secret-not-used-for-anything-real-000",
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/none",
    },
  },
});
