import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("finding change history", () => {
  test("editing a field records a diff in the change history", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /SQL injection in login form/i }).click();
    await expect(page.getByRole("heading", { name: /Edit finding/i })).toBeVisible();

    // Change the remediation text via the edit form and save.
    const editForm = page.locator("form").filter({ has: page.getByRole("button", { name: /save changes/i }) });
    const newText = "Use parameterized queries everywhere " + Date.now();
    await editForm.getByLabel(/^remediation/i).fill(newText);
    await editForm.getByRole("button", { name: /save changes/i }).click();

    // Change history section now shows the Remediation diff (scope to that card;
    // the text also appears in the edit textarea, which is expected).
    const history = page.locator(".card").filter({ has: page.getByText(/Remediation:/i) });
    await expect(history.getByText(/Remediation:/i).first()).toBeVisible();
    await expect(history.getByText(newText).first()).toBeVisible();
  });

  test("client cannot see change history", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /SQL injection in login form/i }).click();
    await expect(page.getByRole("heading", { name: /Change history/i })).toHaveCount(0);
  });
});
