import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("security verification", () => {
  test("security response headers are present", async ({ page }) => {
    const resp = await page.request.get("/login");
    const h = resp.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["strict-transport-security"]).toContain("max-age");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("API requires authentication (401 without session)", async ({ page, context }) => {
    await context.clearCookies();
    const resp = await page.request.get("/api/v1/findings");
    expect(resp.status()).toBe(401);
  });

  test("authenticated API is org-scoped and blocks cross-org objects", async ({ page }) => {
    await login(page, USERS.consultant); // Northwind
    const list = await page.request.get("/api/v1/findings");
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(Array.isArray(body.findings)).toBe(true);
    // Northwind must not receive Globex's finding.
    expect(JSON.stringify(body.findings)).not.toContain("GLOBEX-ONLY");

    // Direct cross-org object fetch → 404.
    const cross = await page.request.get("/api/v1/findings/gx-secret");
    expect(cross.status()).toBe(404);
  });

  test("session cookie is HttpOnly", async ({ page, context }) => {
    await login(page, USERS.admin);
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "jo_session");
    expect(session, "session cookie present").toBeTruthy();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
  });

  test("CLIENT cannot mutate via a server action (RBAC enforced server-side)", async ({ page }) => {
    // Even though the "New assessment" link is visible, the action rejects CLIENT.
    await login(page, USERS.client);
    await page.goto("/dashboard/assessments/new");
    await page.getByLabel(/client name/i).fill("Should Not Persist " + Date.now());
    await page.getByRole("button", { name: /create|save/i }).click();
    // Stays on the form with a permission error; not redirected to a detail page.
    await expect(page.getByText(/do not have permission/i)).toBeVisible();
    await expect(page).toHaveURL(/\/assessments\/new/);
  });
});
