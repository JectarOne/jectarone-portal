import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("reports", () => {
  test("PDF report downloads as application/pdf", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /download pdf report/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("report route sets pdf content-type + attachment disposition", async ({ page }) => {
    await login(page, USERS.consultant);
    const resp = await page.request.get("/dashboard/assessments/nw-web/report");
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("application/pdf");
    expect(resp.headers()["content-disposition"]).toContain("attachment");
  });

  test("generating a report writes an audit row", async ({ page }) => {
    await login(page, USERS.consultant);
    // Trigger a generation, then confirm the assessment lists a report row.
    await page.request.get("/dashboard/assessments/nw-web/report");
    await page.goto("/dashboard/assessments/nw-web");
    await expect(page.getByText(/Security Assessment Report/i).first()).toBeVisible();
  });
});
