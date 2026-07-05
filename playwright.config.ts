import { defineConfig, devices } from "@playwright/test";
import { DB_URL, AUTH_SECRET } from "./test/e2e/db-env";

// Authenticated E2E runs against a seeded Postgres (docker-compose.yml).
// Serial (workers: 1) because specs share one mutable database; global-setup
// resets + reseeds before the run.
const PORT = 3210;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // `next dev` compiles routes on first hit; a cold first attempt can exceed
  // timeouts. Retries re-run against now-warm routes for deterministic results.
  retries: 2,
  reporter: [["list"]],
  globalSetup: "./test/e2e/global-setup.ts",
  // Generous timeouts: `next dev` compiles routes on first hit, so the first
  // navigation/action through a route can take several seconds.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // `next dev` so NODE_ENV=development keeps session cookies non-Secure, which
  // lets both the browser and Playwright's APIRequestContext send them over
  // http://127.0.0.1. (A production build sets Secure cookies that the API
  // client won't send over http, breaking authenticated API assertions.)
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: DB_URL,
      AUTH_SECRET,
    },
  },
});
