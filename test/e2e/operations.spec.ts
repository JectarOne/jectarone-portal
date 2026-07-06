import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("settings: profile + organization + email", () => {
  test("profile name update persists", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/settings/profile");
    const newName = "Karim I " + Date.now();
    await page.getByLabel("Name", { exact: true }).fill(newName);
    await page.getByRole("button", { name: /save profile/i }).click();
    await expect(page.getByText(/profile updated/i)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(newName);
  });

  test("admin can rename the organization; member cannot", async ({ page }) => {
    // Member: field disabled.
    await login(page, USERS.consultant);
    await page.goto("/dashboard/settings/organization");
    await expect(page.getByLabel(/organization name/i)).toBeDisabled();
    await page.getByRole("button", { name: /sign out/i }).click();

    await login(page, USERS.admin);
    await page.goto("/dashboard/settings/organization");
    await page.getByLabel(/organization name/i).fill("Northwind Corp v" + Date.now());
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/organization updated/i)).toBeVisible();
  });

  test("email preferences save", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/settings/notifications");
    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText(/preferences saved/i)).toBeVisible();
  });
});

test.describe("sessions: device list + revocation", () => {
  test("current session is listed as this device", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/settings/sessions");
    await expect(page.getByRole("heading", { name: /active sessions/i })).toBeVisible();
    await expect(page.getByText("This device")).toBeVisible();
  });

  test("signing out other sessions revokes that device", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await login(a, USERS.client);
    await login(b, USERS.client);

    // From B, sign out all other sessions (revokes A). Wait until only B's own
    // session remains, so the revoke has committed before A navigates.
    await b.goto("/dashboard/settings/sessions");
    await b.getByRole("button", { name: /sign out all other sessions/i }).click();
    await expect(b.locator("tbody tr")).toHaveCount(1);

    // A's next request is rejected → redirected to login.
    await a.goto("/dashboard");
    await expect(a).toHaveURL(/\/login/);
    await ctxA.close();
    await ctxB.close();
  });
});

test.describe("audit log", () => {
  test("renders org events and filters", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/settings/audit");
    await expect(page.locator(".timeline-item").first()).toBeVisible();
    await page.locator(".filters").getByRole("link", { name: "Findings" }).click();
    await expect(page).toHaveURL(/cat=finding/);
  });
});

test.describe("API tokens", () => {
  test("admin creates a token that authenticates the API; revoke stops it", async ({ page, request }) => {
    await login(page, USERS.admin);
    await page.goto("/dashboard/settings/api-tokens");
    await page.getByLabel(/token name/i).fill("E2E-" + Date.now());
    await page.getByRole("button", { name: /create token/i }).click();

    const token = (await page.getByTestId("new-token").innerText()).trim();
    expect(token).toMatch(/^jo_/);

    // Token-only request (the `request` fixture carries no browser cookies).
    const ok = await request.get("/api/v1/findings", { headers: { Authorization: `Bearer ${token}` } });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(Array.isArray(body.findings)).toBe(true);

    // No credentials → 401.
    const anon = await request.get("/api/v1/findings");
    expect(anon.status()).toBe(401);

    // Revoke → the token stops working. Wait for the row to disappear (the list
    // filters revokedAt: null) so the revoke has committed before we re-request.
    const row = page.getByRole("row", { name: /E2E-/ });
    await row.getByRole("button", { name: /revoke/i }).first().click();
    await expect(row).toHaveCount(0);
    const revoked = await request.get("/api/v1/findings", { headers: { Authorization: `Bearer ${token}` } });
    expect(revoked.status()).toBe(401);
  });
});
