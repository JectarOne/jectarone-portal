import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("report builder", () => {
  test("consultant can configure and save the report", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web/report/builder");
    await expect(page.getByRole("heading", { name: /report builder/i })).toBeVisible();

    // Exclude a section and reorder.
    await page.getByRole("checkbox", { name: /include MITRE ATT&CK Mapping/i }).uncheck();
    await page.getByRole("button", { name: /move Executive Summary up/i }).click();

    // Custom content.
    await page.getByLabel(/custom recommendations/i).fill("Adopt an SSDLC and quarterly retests.");
    await page.getByLabel(/^appendix/i).fill("Testing performed with Burp Suite and nmap.");

    await page.getByRole("button", { name: /save configuration/i }).click();
    await expect(page.getByText(/report configuration saved/i)).toBeVisible();

    // Persisted after reload.
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /include MITRE ATT&CK Mapping/i })).not.toBeChecked();
    await expect(page.getByLabel(/custom recommendations/i)).toHaveValue(/SSDLC/);
  });

  test("client cannot access the report builder", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/assessments/nw-web/report/builder");
    await expect(page).toHaveURL(/\/dashboard\/assessments$/);
  });
});
