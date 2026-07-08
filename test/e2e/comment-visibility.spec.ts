import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

const PUBLISHED_FINDING = /SQL injection in login form/i;

test.describe("comment visibility + mentions", () => {
  test("consultant sees internal + client comments with visibility badges", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: PUBLISHED_FINDING }).click();

    // Both internal and client-visible comments are shown.
    await expect(page.getByText(/Prioritized as/i)).toBeVisible();       // internal
    await expect(page.getByText(/walk your team through it/i)).toBeVisible(); // client
    // Visibility badges are shown to the team.
    await expect(page.getByText("Internal").first()).toBeVisible();
    await expect(page.getByText("Client-visible").first()).toBeVisible();
    // @mention is rendered as a highlighted span.
    await expect(page.locator(".comment-body .mention").first()).toBeVisible();
  });

  test("client sees only client-visible comments", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: PUBLISHED_FINDING }).click();

    await expect(page.getByText(/walk your team through it/i)).toBeVisible();  // client-visible
    await expect(page.getByText(/Prioritized as/i)).toHaveCount(0);            // internal hidden
    // Clients can't post comments.
    await expect(page.locator('textarea[name="body"]')).toHaveCount(0);
  });

  test("a new client-visible comment reaches the client", async ({ page, browser }) => {
    // Consultant posts a client-visible comment.
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: PUBLISHED_FINDING }).click();
    const marker = "Client update " + Date.now();
    await page.locator('textarea[name="body"]').fill(marker);
    await page.locator('select[name="visibility"]').selectOption("client");
    await page.getByRole("button", { name: /^comment$/i }).click();
    await expect(page.getByText(marker)).toBeVisible();

    // Client sees it.
    const ctx = await browser.newContext();
    const cpage = await ctx.newPage();
    await login(cpage, USERS.client);
    await cpage.goto("/dashboard/findings");
    await cpage.getByRole("link", { name: PUBLISHED_FINDING }).click();
    await expect(cpage.getByText(marker)).toBeVisible();
    await ctx.close();
  });
});
