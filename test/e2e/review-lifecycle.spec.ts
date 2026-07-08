import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("finding review lifecycle", () => {
  test("consultant can advance the review state", async ({ page }) => {
    await login(page, USERS.consultant);
    // Open the seeded InReview finding.
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /Missing security headers/i }).click();
    await expect(page.getByRole("heading", { name: /Missing security headers/i })).toBeVisible();

    // Review card: InReview -> Approved.
    const reviewForm = page.locator("form").filter({ has: page.locator('select[name="reviewState"]') });
    await reviewForm.locator('select[name="reviewState"]').selectOption("Approved");
    await reviewForm.getByRole("button", { name: /set/i }).click();

    await expect(page.getByRole("heading", { level: 1 }).getByText("Approved")).toBeVisible();
  });

  test("client sees only published findings", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/findings");

    // Published finding is visible.
    await expect(page.getByRole("link", { name: /SQL injection in login form/i })).toBeVisible();
    // Non-published (Draft / InReview) findings are hidden from the CLIENT.
    await expect(page.getByRole("link", { name: /Verbose error messages/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Missing security headers/i })).toHaveCount(0);
  });

  test("client is 404'd from a non-published finding by direct URL", async ({ page, browser }) => {
    // Find a non-published finding id as the consultant (has full access).
    const ctx = await browser.newContext();
    const cpage = await ctx.newPage();
    await login(cpage, USERS.consultant);
    await cpage.goto("/dashboard/findings");
    await cpage.getByRole("link", { name: /Verbose error messages/i }).click();
    await cpage.waitForURL(/\/findings\/[^/]+$/);
    const url = cpage.url();
    await ctx.close();

    // CLIENT hitting that same URL must not see the finding content (notFound).
    await login(page, USERS.client);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: /Verbose error messages/i })).toHaveCount(0);
    // The review card / edit controls must not render for the client here either.
    await expect(page.locator('select[name="reviewState"]')).toHaveCount(0);
  });
});
