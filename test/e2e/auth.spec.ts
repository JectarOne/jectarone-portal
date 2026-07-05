import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, logout, USERS, PASSWORD, makeSessionCookie, expectOnLogin } from "./helpers";

const BLOCKING = new Set(["serious", "critical"]);

test.describe("auth: public pages", () => {
  test("login page renders with accessible labels", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/JectarOne/i);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/work email/i)).toBeVisible();
    await expect(page.getByLabel(/^password/i)).toBeVisible();
  });

  test("login page: no serious/critical axe violations", async ({ page }) => {
    await page.goto("/login");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = r.violations.filter((v) => BLOCKING.has(v.impact || ""));
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });

  test("signup page renders + no serious/critical axe violations", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/organization/i)).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = r.violations.filter((v) => BLOCKING.has(v.impact || ""));
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });
});

test.describe("auth: sessions", () => {
  test("login then logout", async ({ page }) => {
    await login(page, USERS.admin);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await logout(page);
    await expectOnLogin(page);
  });

  test("invalid credentials show a generic error and do not authenticate", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/work email/i).fill(USERS.admin);
    await page.getByLabel(/^password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard requires a session (redirects to login)", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard");
    await expectOnLogin(page);
  });

  test("expired session token is rejected (redirect to login)", async ({ page, context }) => {
    // Forge a validly-signed but EXPIRED token; middleware must reject it.
    const token = await makeSessionCookie("any-user", "any-org", -60);
    await context.addCookies([
      { name: "jo_session", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    await expectOnLogin(page);
  });

  test("brute-force throttle kicks in after repeated failures", async ({ page }) => {
    const email = "throttle-probe@northwind.test"; // not a real account
    for (let i = 0; i < 5; i++) {
      await page.goto("/login");
      await page.getByLabel(/work email/i).fill(email);
      await page.getByLabel(/^password/i).fill("bad-guess-" + i);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page.getByText(/incorrect email or password|too many attempts/i)).toBeVisible();
    }
    // Next attempt should be throttled regardless of credentials.
    await page.goto("/login");
    await page.getByLabel(/work email/i).fill(email);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/too many attempts/i)).toBeVisible();
  });
});
