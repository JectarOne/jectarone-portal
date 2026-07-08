import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("risk acceptance expiry", () => {
  test("expired acceptance is auto-reopened when the risk register is viewed", async ({ page }) => {
    await login(page, USERS.consultant);

    // Visiting the findings list runs the sweep (MEMBER+).
    await page.goto("/dashboard/findings");
    await expect(page.getByRole("link", { name: /Legacy cipher accepted/i })).toBeVisible();

    // Open the finding — it should now be Open (reopened), not AcceptedRisk.
    await page.getByRole("link", { name: /Legacy cipher accepted/i }).click();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Open")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Accepted Risk")).toHaveCount(0);

    // Timeline records the expiry.
    await expect(page.getByText(/finding\.risk_expired/i)).toBeVisible();
  });
});
