import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("engagements", () => {
  test("consultant creates an engagement", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/engagements");
    await expect(page.getByRole("heading", { name: /^Engagements$/i })).toBeVisible();
    // Seeded engagement is listed.
    await expect(page.getByRole("link", { name: /Q3 External Assessment/i })).toBeVisible();

    await page.getByRole("link", { name: /new engagement/i }).click();
    const name = "Retest Engagement " + Date.now();
    await page.locator("#name").fill(name);
    await page.locator("#clientName").fill("Northwind Corp");
    await page.getByRole("button", { name: /create engagement/i }).click();

    await page.waitForURL(/\/dashboard\/engagements\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(page.getByRole("heading", { level: 1 }).getByText("Scoping")).toBeVisible();
  });

  test("consultant advances the engagement lifecycle", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/engagements/nw-eng");
    await expect(page.getByRole("heading", { level: 1 }).getByText("Active")).toBeVisible();

    const card = page.locator(".card").filter({ has: page.locator('select[name="status"]') });
    await card.locator('select[name="status"]').selectOption("Reporting");
    await card.getByRole("button", { name: /advance/i }).click();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Reporting")).toBeVisible();
  });

  test("adding an assessment from an engagement preselects and links it", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/engagements/nw-eng");
    await page.getByRole("link", { name: /add assessment/i }).click();

    // Engagement is preselected on the new-assessment form.
    await expect(page.getByLabel(/^engagement/i)).toHaveValue(/.+/);
    await page.getByLabel(/client name/i).fill("Northwind Corp");
    await page.getByRole("button", { name: /create assessment/i }).click();

    // Assessment detail shows the engagement link.
    await expect(page.getByText(/Engagement:/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Q3 External Assessment/i })).toBeVisible();
  });

  test("client cannot create engagements", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/engagements");
    await expect(page.getByRole("link", { name: /new engagement/i })).toHaveCount(0);
    await page.goto("/dashboard/engagements/new");
    await expect(page).toHaveURL(/\/dashboard\/engagements$/);
  });
});
