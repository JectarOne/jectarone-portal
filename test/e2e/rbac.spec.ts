import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("RBAC + organization isolation", () => {
  test("a user never sees another org's findings", async ({ page }) => {
    await login(page, USERS.consultant); // Northwind
    await page.goto("/dashboard/findings");
    await expect(page.getByText(/GLOBEX-ONLY secret finding/i)).toHaveCount(0);
    await expect(page.getByRole("cell", { name: /SQL injection/i })).toBeVisible();
  });

  // notFound() runs inside a streamed server component (loading.tsx is present),
  // so Next returns 200 with the not-found body rather than a 404 status. The
  // security guarantee is that NO cross-org data renders — assert that.
  test("cross-org assessment access by direct URL leaks no data", async ({ page }) => {
    await login(page, USERS.consultant); // Northwind
    await page.goto("/dashboard/assessments/gx-web"); // Globex assessment
    await page.waitForLoadState("networkidle");
    // No Globex assessment content and none of its detail controls render.
    await expect(page.getByText(/Globex/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download pdf report/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^archive$/i })).toHaveCount(0);
  });

  test("cross-org finding access by direct URL leaks no data", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/gx-web/findings/gx-secret");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/GLOBEX-ONLY secret finding/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Update" })).toHaveCount(0);
  });

  test("other org sees only its own data", async ({ page }) => {
    await login(page, USERS.globexAdmin);
    await page.goto("/dashboard/findings");
    await expect(page.getByRole("cell", { name: /GLOBEX-ONLY secret finding/i })).toBeVisible();
    await expect(page.getByText(/SQL injection/i)).toHaveCount(0);
  });

  test("CLIENT role is read-only (can view, cannot mutate)", async ({ page }) => {
    await login(page, USERS.client);
    // Can view the findings list.
    await page.goto("/dashboard/findings");
    await expect(page.getByRole("cell", { name: /SQL injection/i })).toBeVisible();
    // On a finding, no status/assign/edit controls are rendered.
    await page.goto("/dashboard/assessments/nw-web");
    await page.getByRole("row", { name: /SQL injection/i }).getByRole("link", { name: /open/i }).click();
    await page.waitForURL(/\/findings\/[^/]+$/);
    await expect(page.getByRole("button", { name: "Update" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add evidence/i })).toHaveCount(0);
    await expect(page.getByPlaceholder(/add a comment/i)).toHaveCount(0);
  });
});
