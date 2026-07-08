import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("finding templates", () => {
  test("consultant sees built-in library, can search + filter", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/templates");
    await expect(page.getByRole("heading", { name: /finding templates/i })).toBeVisible();

    // Built-in library is seeded and marked read-only.
    await expect(page.getByRole("cell", { name: /SQL Injection/i })).toBeVisible();
    await expect(page.getByText("built-in").first()).toBeVisible();

    // Search narrows the list.
    await page.getByRole("searchbox", { name: /search templates/i }).fill("Kerberoasting");
    await page.getByRole("button", { name: /filter/i }).click();
    await expect(page.getByRole("cell", { name: /Kerberoasting/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /SQL Injection/i })).toHaveCount(0);
  });

  test("New Finding prefills from a template", async ({ page }) => {
    await login(page, USERS.consultant);

    // Seed uses stable assessment ids (e.g. nw-web).
    await page.goto("/dashboard/assessments/nw-web/findings/new");
    await expect(page.getByRole("heading", { name: /new finding/i })).toBeVisible();

    // Picker lists templates; choose SQL Injection.
    await page.getByRole("listitem").filter({ hasText: /SQL Injection/i }).first().click();
    await page.waitForURL(/template=/);

    // Form should be prefilled from the template.
    await expect(page.getByLabel(/title/i)).toHaveValue(/SQL Injection/i);
    await expect(page.getByLabel(/^severity/i)).toHaveValue("Critical");
    await expect(page.getByLabel(/CVSS base score/i)).toHaveValue("9.8");
    await expect(page.getByText(/Prefilled from/i)).toBeVisible();
  });

  test("client (read-only) cannot create templates", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/templates");
    await expect(page.getByRole("link", { name: /new template/i })).toHaveCount(0);
    // Direct nav to the create page is redirected away.
    await page.goto("/dashboard/templates/new");
    await expect(page).toHaveURL(/\/dashboard\/templates$/);
  });
});
