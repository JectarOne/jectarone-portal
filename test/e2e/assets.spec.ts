import { test, expect, Page } from "@playwright/test";
import { login, USERS } from "./helpers";

async function createAsset(page: Page, name: string, type = "URL") {
  await page.goto("/dashboard/assets/new");
  await page.getByLabel(/^name/i).fill(name);
  await page.getByLabel(/^type/i).selectOption(type);
  await page.getByRole("button", { name: /create asset|save/i }).click();
  await page.waitForURL(/\/dashboard\/assets$/);
}

test.describe("assets", () => {
  test("create → appears in the list", async ({ page }) => {
    await login(page, USERS.consultant);
    const name = "E2E Asset " + Date.now();
    await createAsset(page, name);
    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("edit persists changes", async ({ page }) => {
    await login(page, USERS.consultant);
    const name = "E2E EditAsset " + Date.now();
    await createAsset(page, name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("link", { name: /edit/i }).click();
    const newName = name + " v2";
    await page.getByLabel(/^name/i).fill(newName);
    await page.getByRole("button", { name: /save/i }).click();
    // updateAssetAction returns without redirect; verify from the list.
    await expect(page.locator(".alert-error")).toHaveCount(0);
    await page.goto("/dashboard/assets");
    await expect(page.getByRole("cell", { name: newName })).toBeVisible();
  });

  test("archive filter separates active/archived", async ({ page }) => {
    await login(page, USERS.consultant);
    const name = "E2E ArchiveAsset " + Date.now();
    await createAsset(page, name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: /archive/i }).click();
    // Gone from active…
    await expect(page.getByRole("cell", { name })).toHaveCount(0);
    // …present under archived.
    await page.goto("/dashboard/assets?archived=1");
    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("admin can delete an asset; consultant cannot", async ({ page }) => {
    await login(page, USERS.consultant);
    const name = "E2E DeleteAsset " + Date.now();
    await createAsset(page, name);
    // Consultant sees no Delete on the row.
    await expect(page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: /delete/i })).toHaveCount(0);

    await page.getByRole("button", { name: /sign out/i }).click();
    await login(page, USERS.admin);
    await page.goto("/dashboard/assets");
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: /delete/i }).click();
    await expect(page.getByRole("cell", { name })).toHaveCount(0);
  });
});
