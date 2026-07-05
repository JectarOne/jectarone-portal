import { test, expect } from "@playwright/test";
import { login, USERS, PASSWORD, waitForEmail, tokenFromEmail, signupVerified } from "./helpers";

// Email is not configured in E2E → the app writes messages to .mail-outbox/,
// which these tests read to obtain verification / reset tokens.

test.describe("email verification", () => {
  test("new signup is gated until the email is verified", async ({ page }) => {
    const email = `verify-${Date.now()}@northwind.test`;
    await page.goto("/signup");
    await page.getByLabel(/your name/i).fill("New User");
    await page.getByLabel(/organization/i).fill("Verify Co " + Date.now());
    await page.getByLabel(/work email/i).fill(email);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /create organization/i }).click();

    // Signed in but unverified → the dashboard redirects to the verify page.
    await page.waitForURL(/\/verify-email/);
    await expect(page.getByRole("heading", { name: /verify your email/i })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/verify-email/); // still gated

    // Consume the verification link, then the dashboard opens.
    const mail = await waitForEmail("/verify-email?token=", { to: email });
    expect(mail.to).toBe(email);
    await page.goto(`/verify-email?token=${tokenFromEmail(mail.text)}`);
    await expect(page.getByText(/your email is verified/i)).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("an invalid verification token is rejected", async ({ page }) => {
    await page.goto("/verify-email?token=not-a-real-token");
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});

test.describe("password reset", () => {
  test("request → reset → sign in with the new password", async ({ page }) => {
    // Use an isolated fresh account so seeded users' passwords stay intact.
    const email = `reset-${Date.now()}@northwind.test`;
    await signupVerified(page, email);

    await page.goto("/forgot-password");
    await page.getByLabel(/work email/i).fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/reset link is on its way/i)).toBeVisible();

    const mail = await waitForEmail("/reset-password?token=", { to: email });
    const token = tokenFromEmail(mail.text);

    // Set a new password.
    const newPassword = "NewPassw0rd!" + Date.now();
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel(/new password/i).fill(newPassword);
    await page.getByRole("button", { name: /set new password/i }).click();
    await page.waitForURL(/\/login/);

    // Old password no longer works; new one does.
    await page.getByLabel(/work email/i).fill(email);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();

    await login(page, email, newPassword);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("the reset token is single-use", async ({ page }) => {
    const email = `single-${Date.now()}@northwind.test`;
    await signupVerified(page, email);
    await page.goto("/forgot-password");
    await page.getByLabel(/work email/i).fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    const mail = await waitForEmail("/reset-password?token=", { to: email });
    const token = tokenFromEmail(mail.text);

    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel(/new password/i).fill("AdminNewPass!123");
    await page.getByRole("button", { name: /set new password/i }).click();
    await page.waitForURL(/\/login/);

    // Reusing the same token must fail.
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel(/new password/i).fill("AnotherPass!123");
    await page.getByRole("button", { name: /set new password/i }).click();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });

  test("forgot-password does not reveal whether an email exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(/work email/i).fill("nobody-here@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/if that email has an account/i)).toBeVisible();
  });
});
