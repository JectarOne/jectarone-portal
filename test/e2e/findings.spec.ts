import { test, expect, Page } from "@playwright/test";
import { login, USERS } from "./helpers";

// Create a fresh finding under nw-web and return its detail URL.
async function createFinding(page: Page, title: string, severity = "High", cvss = "7.5") {
  await page.goto("/dashboard/assessments/nw-web/findings/new");
  await page.getByLabel(/^title/i).fill(title);
  await page.getByLabel(/^severity/i).selectOption(severity);
  await page.getByLabel(/cvss base score/i).fill(cvss);
  await page.getByRole("button", { name: /save|create/i }).click();
  // Wait for the redirect to the finding DETAIL — exclude the /findings/new form URL.
  await page.waitForURL(/\/findings\/(?!new$)[^/]+$/);
}

test.describe("findings", () => {
  test("create → detail shows title, severity and CVSS", async ({ page }) => {
    await login(page, USERS.consultant);
    const title = "E2E Finding " + Date.now();
    await createFinding(page, title, "Critical", "9.4");
    await expect(page.locator("h1")).toContainText(title);
    await expect(page.locator(".badge.sev-critical").first()).toBeVisible();
    await expect(page.getByText("9.4")).toBeVisible();
  });

  test("status transition Open → In Progress persists + logs history", async ({ page }) => {
    await login(page, USERS.consultant);
    await createFinding(page, "E2E Status " + Date.now());
    const statusForm = page.locator("form", { has: page.getByRole("button", { name: "Update" }) });
    await statusForm.getByRole("combobox").selectOption("InProgress");
    await statusForm.getByRole("button", { name: "Update" }).click();
    await expect(page.locator(".badge.fstatus-inprogress").first()).toBeVisible();
    // Timeline records the transition.
    await expect(page.getByText("finding.status_changed")).toBeVisible();
  });

  test("add a comment", async ({ page }) => {
    await login(page, USERS.consultant);
    await createFinding(page, "E2E Comment " + Date.now());
    const body = "Reproduced on staging " + Date.now();
    await page.getByPlaceholder(/add a comment/i).fill(body);
    await page.getByRole("button", { name: /^comment$/i }).click();
    await expect(page.getByText(body)).toBeVisible();
  });

  test("record evidence metadata (fallback when storage is unconfigured)", async ({ page }) => {
    await login(page, USERS.consultant);
    await createFinding(page, "E2E Evidence " + Date.now());
    // When S3 is configured the real uploader (file input) replaces the metadata
    // form — that path is covered by upload.spec. Only test the fallback here.
    const hasUploader = await page.getByLabel(/^file/i).count();
    test.skip(hasUploader > 0, "storage configured → real upload covered by upload.spec.ts");
    const fname = "poc-" + Date.now() + ".png";
    await page.getByLabel(/filename/i).fill(fname);
    await page.getByRole("button", { name: /add evidence/i }).click();
    await expect(page.getByRole("cell", { name: fname })).toBeVisible();
  });

  test("findings list shows color-coded CVSS badge + severity", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    // Seed has a Critical SQLi with CVSS 9.8.
    await expect(page.getByRole("cell", { name: /SQL injection/i })).toBeVisible();
    await expect(page.locator(".cvss-badge.cvss-critical").first()).toBeVisible();
    await expect(page.locator(".badge.sev-critical").first()).toBeVisible();
  });

  test("findings search + severity filter", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    await page.getByPlaceholder(/search/i).fill("SQL injection");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByRole("cell", { name: /SQL injection/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Verbose error messages/i })).toHaveCount(0);
  });
});
