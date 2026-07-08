import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("AI security assistant", () => {
  test("consultant can generate a finding suggestion (mock provider)", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /SQL injection in login form/i }).click();

    const panel = page.locator(".ai-assist").filter({ hasText: /AI/ });
    await expect(page.getByRole("heading", { name: /AI assistance/i })).toBeVisible();
    await panel.getByRole("button", { name: /generate remediation/i }).click();

    // Mock provider echoes a grounded, clearly-labelled result + disclaimer.
    await expect(panel.locator(".ai-output")).toContainText("[AI mock]", { timeout: 15000 });
    await expect(panel.getByText(/AI-generated suggestion/i)).toBeVisible();
  });

  test("consultant can generate an assessment executive summary", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web");
    const panel = page.locator(".ai-assist");
    await expect(page.getByRole("heading", { name: /AI assistance/i })).toBeVisible();
    await panel.getByRole("button", { name: /executive summary/i }).click();
    await expect(panel.locator(".ai-output")).toContainText("[AI mock]", { timeout: 15000 });
  });

  test("client cannot see the AI assistant", async ({ page }) => {
    await login(page, USERS.client);
    // Published finding is reachable to the client, but the AI panel is MEMBER+.
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /SQL injection in login form/i }).click();
    await expect(page.getByRole("heading", { name: /AI assistance/i })).toHaveCount(0);
    await expect(page.locator(".ai-assist")).toHaveCount(0);
  });
});
