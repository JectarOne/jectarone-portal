import { test, expect, type Page } from "@playwright/test";
import { login, USERS } from "./helpers";

async function openFinding(page: Page, name: RegExp) {
  await page.goto("/dashboard/findings");
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name: /^Retest \d/ })).toBeVisible();
}

// Drive a fresh retest to a terminal outcome. Idempotent across retries: if an
// open retest already exists (from a prior attempt) it reuses it.
async function runRetest(page: Page, outcome: "Mark verified" | "Mark failed") {
  const requestBtn = page.getByRole("button", { name: /request retest/i });
  if (await requestBtn.count()) {
    await requestBtn.click();
    // Wait for the open-retest view (advance select) to settle before interacting.
    await expect(page.locator('select[name="retestStatus"]')).toBeVisible();
  }
  const statusSelect = page.locator('select[name="retestStatus"]');
  // Advance to InProgress if not already there (the complete form only shows at InProgress).
  const markBtn = page.getByRole("button", { name: new RegExp(outcome, "i") });
  if ((await markBtn.count()) === 0 && (await statusSelect.count())) {
    await statusSelect.selectOption("InProgress");
    await page.getByRole("button", { name: /advance retest/i }).click();
  }
  await expect(markBtn).toBeVisible({ timeout: 20000 });
  const result = page.locator('textarea[name="result"]');
  if (await result.count()) await result.fill("Retest result.");
  await markBtn.click();
}

test.describe("retest workflow", () => {
  test("consultant requests a retest for a finding", async ({ page }) => {
    await login(page, USERS.consultant);
    await openFinding(page, /SQL injection in login form/i);

    const requestBtn = page.getByRole("button", { name: /request retest/i });
    if (await requestBtn.count()) await requestBtn.click();
    // An open retest now exists → the advance control (retest status select) shows.
    await expect(page.locator('select[name="retestStatus"]')).toBeVisible();
    await expect(page.locator(".badge.rt-requested, .badge.rt-scheduled, .badge.rt-inprogress").first()).toBeVisible();
  });

  test("verified retest resolves the finding", async ({ page }) => {
    await login(page, USERS.consultant);
    await openFinding(page, /Missing security headers/i);
    await runRetest(page, "Mark verified");

    await expect(page.getByRole("heading", { level: 1 }).getByText("Resolved")).toBeVisible();
    await expect(page.getByText("Verified").first()).toBeVisible();
  });

  test("failed retest reopens the finding", async ({ page }) => {
    await login(page, USERS.consultant);
    await openFinding(page, /Server banner discloses version/i);
    await runRetest(page, "Mark failed");

    await expect(page.getByRole("heading", { level: 1 }).getByText("Open")).toBeVisible();
    await expect(page.getByText("Failed").first()).toBeVisible();
  });

  test("dashboard shows the retest queue widget", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /retest queue/i })).toBeVisible();
    await expect(page.getByText(/Retests waiting/i)).toBeVisible();
    await expect(page.getByText(/Avg\. verification/i)).toBeVisible();
  });

  test("client cannot see the retest panel", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /SQL injection in login form/i }).click();
    await expect(page.getByRole("heading", { name: /^Retest \d/ })).toHaveCount(0);
  });
});
