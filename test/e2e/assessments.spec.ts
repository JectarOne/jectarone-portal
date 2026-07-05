import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("assessments", () => {
  test("create → redirects to detail", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/new");
    const name = "E2E Created " + Date.now();
    await page.getByLabel(/client name/i).fill(name);
    await page.getByLabel(/assessment type/i).selectOption("Network");
    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForURL(/\/dashboard\/assessments\/[^/]+$/);
    await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  });

  test("edit persists changes", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web/edit");
    const lead = "Lead " + Date.now();
    await page.getByLabel(/lead consultant/i).fill(lead);
    await page.getByRole("button", { name: /save/i }).click();
    await page.goto("/dashboard/assessments/nw-web");
    await expect(page.getByText(lead)).toBeVisible();
  });

  test("status filter narrows the list", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments?status=Delivered");
    // Seed: only the Network assessment is Delivered + not archived.
    await expect(page.getByRole("cell", { name: "Network" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cloud" })).toHaveCount(0);
  });

  test("archived filter shows archived assessments", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments?status=Archived");
    await expect(page.getByRole("cell", { name: /ISO 27001/i })).toBeVisible();
  });

  test("archive toggles the assessment", async ({ page }) => {
    await login(page, USERS.consultant);
    // Create a throwaway assessment to archive.
    await page.goto("/dashboard/assessments/new");
    const name = "E2E Archive " + Date.now();
    await page.getByLabel(/client name/i).fill(name);
    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForURL(/\/dashboard\/assessments\/[^/]+$/);
    await page.getByRole("button", { name: /^archive$/i }).click();
    await expect(page.getByRole("button", { name: /unarchive/i })).toBeVisible();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  });

  test("admin can delete an assessment (consultant cannot)", async ({ page }) => {
    // Consultant (MEMBER) sees no Delete button.
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web");
    await expect(page.getByRole("button", { name: /^delete$/i })).toHaveCount(0);

    // Admin (OWNER) can delete a throwaway assessment.
    await page.getByRole("button", { name: /sign out/i }).click();
    await login(page, USERS.admin);
    await page.goto("/dashboard/assessments/new");
    const name = "E2E Delete " + Date.now();
    await page.getByLabel(/client name/i).fill(name);
    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForURL(/\/dashboard\/assessments\/[^/]+$/);
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page.waitForURL(/\/dashboard\/assessments$/);
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
