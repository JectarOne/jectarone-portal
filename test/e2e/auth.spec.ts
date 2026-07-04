import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BLOCKING = new Set(["serious", "critical"]);

test.describe("login page", () => {
  test("renders form with accessible labels", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/JectarOne/i);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    // Inputs are reachable by their <label for=…> associations.
    await expect(page.getByLabel(/work email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create an organization/i })).toBeVisible();
  });

  test("email and password fields are keyboard reachable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "tab order is a desktop concern here");
    await page.goto("/login");
    await page.getByLabel(/work email/i).focus();
    await expect(page.getByLabel(/work email/i)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/password/i)).toBeFocused();
  });

  test("no serious/critical axe violations", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "axe once on desktop");
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact || ""));
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });
});

test.describe("signup page", () => {
  test("renders all fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/organization/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create|sign up/i })).toBeVisible();
  });

  test("no serious/critical axe violations", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "axe once on desktop");
    await page.goto("/signup");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact || ""));
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });
});
