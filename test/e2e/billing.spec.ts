import { test, expect } from "@playwright/test";
import { login, signupVerified, USERS } from "./helpers";

test.describe("billing dashboard", () => {
  test("shows the current plan, status, and usage for a paying customer", async ({ page }) => {
    await login(page, USERS.admin); // Northwind: Professional, active
    await page.goto("/dashboard/settings/billing");
    await expect(page.getByRole("heading", { name: /current plan/i })).toBeVisible();
    await expect(page.getByText("Professional").first()).toBeVisible();
    await expect(page.getByText("Active").first()).toBeVisible();
    await expect(page.getByText(/AI requests/i).first()).toBeVisible();
    // The AI-requests count is a live counter shared with every other spec that
    // exercises the AI assistant against this same org this month — assert the
    // format (N of a 5000 Professional-tier limit), not a specific N, since the
    // exact value legitimately drifts with suite run order.
    await expect(page.getByText(/\d+ \/ 5000/)).toBeVisible();
  });

  test("trial org sees the trial banner across the dashboard", async ({ page }) => {
    await login(page, USERS.globexAdmin); // Globex: trialing
    await page.goto("/dashboard");
    await expect(page.getByText(/days? left in your free trial/i)).toBeVisible();
  });

  test("admin can upgrade via mock checkout and the plan updates", async ({ page }) => {
    // Fresh signup (OWNER, trialing-Professional by default) — isolated from
    // the shared Starter fixture used by the plan-limit tests below, since
    // this test intentionally changes its org's plan.
    await signupVerified(page, `checkout-${Date.now()}@example.test`);
    await page.goto("/dashboard/settings/billing");
    await expect(page.getByText(/^trial$/i).first()).toBeVisible();

    // Choose Business from the plan picker.
    const businessCard = page.locator(".card").filter({ has: page.getByRole("heading", { name: /^Business$/ }) });
    await businessCard.getByRole("button", { name: /choose plan/i }).click();

    // Mock checkout page (Stripe unconfigured in this test env).
    await expect(page.getByText(/TEST MODE/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /subscribe to business/i })).toBeVisible();
    await page.getByRole("button", { name: /^pay \$/i }).click();

    // Back on billing, now on Business, active.
    await page.waitForURL(/checkout=success/);
    await expect(page.getByRole("heading", { name: /current plan/i })).toBeVisible();
    await expect(page.locator(".card").first().getByText("Business")).toBeVisible();
  });

  test("cancel and resume subscription (mock mode self-service)", async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto("/dashboard/settings/billing");
    await page.getByRole("button", { name: /cancel subscription/i }).click();
    await expect(page.getByText(/cancels/i)).toBeVisible();
    await page.getByRole("button", { name: /resume subscription/i }).click();
    await expect(page.getByText(/cancels/i)).toHaveCount(0);
  });

  test("non-admin cannot manage billing", async ({ page }) => {
    await login(page, USERS.consultant); // Northwind MEMBER
    await page.goto("/dashboard/settings/billing");
    await expect(page.getByRole("button", { name: /cancel subscription/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /manage billing/i })).toHaveCount(0);
  });
});

test.describe("API token plan gating", () => {
  // Regression (Sprint 19 audit): only token *creation* was plan-gated. A token
  // minted while an org had the "api" feature kept working forever after a
  // downgrade/cancellation/trial expiry. The gate must run on every request.
  test("token from an org whose plan lacks the api feature is rejected; Professional token works", async ({ request }) => {
    const ok = await request.get("/api/v1/findings", {
      headers: { authorization: "Bearer jo_e2e_northwind_000000000000" }, // Northwind: Professional
    });
    expect(ok.status()).toBe(200);

    const blocked = await request.get("/api/v1/findings", {
      headers: { authorization: "Bearer jo_e2e_starter_00000000000000" }, // Acme Starter: no api feature
    });
    expect(blocked.status()).toBe(403);
  });
});

test.describe("plan limit enforcement", () => {
  test("Starter org at its user limit cannot invite another member", async ({ page }) => {
    await login(page, USERS.starterOwner); // already has 2/2 users (Starter cap)
    await page.goto("/dashboard/team");
    await page.getByLabel(/^name/i).fill("Third Person");
    // Unique email per attempt: on a Playwright retry the limit check must be
    // what blocks this, not a stale "already a member" collision from a
    // previous attempt against the same fixed address.
    await page.getByLabel(/^email/i).fill(`third-${Date.now()}@acme-starter.test`);
    await page.getByLabel(/password/i).fill("Passw0rd!123");
    await page.getByRole("button", { name: /add member/i }).click();
    await expect(page.getByText(/upgrade/i)).toBeVisible();
  });

  test("Starter org at its engagement limit cannot create another engagement", async ({ page }) => {
    await login(page, USERS.starterOwner); // already has 5/5 engagements (Starter cap)
    await page.goto("/dashboard/engagements/new");
    await page.locator("#name").fill("One Too Many");
    await page.locator("#clientName").fill("Acme Starter Co");
    await page.getByRole("button", { name: /create engagement/i }).click();
    await expect(page.getByText(/upgrade/i)).toBeVisible();
  });

  // Regression (Sprint 19 audit): maxFindings was displayed on the billing page
  // but never enforced — a Starter org could create unlimited findings.
  test("Starter org at its finding limit cannot create another finding", async ({ page }) => {
    await login(page, USERS.starterOwner); // already has 100/100 findings (Starter cap)
    await page.goto("/dashboard/assessments/starter-assess/findings/new");
    await page.getByLabel(/^title/i).fill("Finding 101");
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText(/upgrade/i)).toBeVisible();
  });
});
