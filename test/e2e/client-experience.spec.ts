import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, USERS } from "./helpers";
import { S3 } from "./db-env";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const s3 = new S3Client({ region: S3.region, endpoint: S3.endpoint, forcePathStyle: true, credentials: { accessKeyId: S3.accessKeyId, secretAccessKey: S3.secretAccessKey } });
let storageUp = true;
test.beforeAll(async () => { try { await s3.send(new ListObjectsV2Command({ Bucket: S3.bucket, MaxKeys: 1 })); } catch { storageUp = false; } });

test.describe("dashboard: score + charts + widgets", () => {
  test("renders security score, metrics, and all four charts", async ({ page }) => {
    await login(page, USERS.consultant);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    // Security score hero.
    await expect(page.locator(".score-grade")).toContainText(/Security score/i);
    await expect(page.locator(".score-num strong")).toBeVisible();

    // Key metric widgets.
    await expect(page.getByText("Open findings", { exact: true })).toBeVisible();
    await expect(page.getByText("Critical (open)", { exact: true })).toBeVisible();
    await expect(page.getByText("Assessments in progress", { exact: true })).toBeVisible();

    // Charts: donut (severity), bars (status + assets), area (over time).
    await expect(page.locator("svg.donut").first()).toBeVisible();
    await expect(page.locator(".chart-bars").first()).toBeVisible();
    await expect(page.locator("svg.arealine")).toBeVisible();
    await expect(page.getByRole("heading", { name: /findings by severity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /assets by risk/i })).toBeVisible();

    // Widget lists.
    await expect(page.getByRole("heading", { name: /recently resolved/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /upcoming assessments/i })).toBeVisible();
  });

  test("dashboard has no serious/critical axe violations", async ({ page }) => {
    await login(page, USERS.consultant);
    await expect(page.locator("svg.donut").first()).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = r.violations.filter((v) => ["serious", "critical"].includes(v.impact || ""));
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });
});

test.describe("activity feed + assessment timeline", () => {
  test("activity feed lists org events", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.getByRole("link", { name: "Activity" }).click();
    await page.waitForURL(/\/dashboard\/activity/);
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.locator(".timeline-item").first()).toBeVisible();
  });

  test("assessment detail shows a timeline", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web");
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await expect(page.locator(".timeline-item").first()).toBeVisible();
  });
});

test.describe("dark / light mode", () => {
  test("toggle switches theme and persists across reload", async ({ page }) => {
    // No stored pref + OS dark → app starts dark (init script + component agree).
    await page.emulateMedia({ colorScheme: "dark" });
    await login(page, USERS.consultant);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: /switch to light mode/i }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light"); // persisted
  });
});

test.describe("mobile", () => {
  test("dashboard renders on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, USERS.consultant);
    await expect(page.locator(".score-num strong")).toBeVisible();
    await expect(page.getByText("Open findings", { exact: true })).toBeVisible();
    // No horizontal overflow of the document.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(overflow).toBe(true);
  });
});

test.describe("evidence gallery", () => {
  test("renders seeded evidence as gallery cards with a download count", async ({ page }) => {
    await login(page, USERS.consultant);
    await page.goto("/dashboard/findings");
    await page.getByRole("link", { name: /SQL injection/i }).first().click();
    await page.waitForURL(/\/findings\/[^/]+$/);
    // Seeded finding has evidence (poc.png, request.txt) → gallery cards render.
    await expect(page.locator(".ev-card").first()).toBeVisible();
    await expect(page.locator(".ev-card .file-icon").first()).toBeVisible();
    await expect(page.locator(".ev-dl").first()).toContainText("⬇");
  });

  test("uploading then downloading increments the download count", async ({ page }) => {
    test.skip(!storageUp, "MinIO not running");
    await login(page, USERS.consultant);
    await page.goto("/dashboard/assessments/nw-web/findings/new");
    await page.getByLabel(/^title/i).fill("Gallery DL " + Date.now());
    await page.getByRole("button", { name: /create finding/i }).click();
    await page.waitForURL(/\/findings\/(?!new$)[^/]+$/);
    const url = page.url();

    await page.getByLabel(/^file/i).setInputFiles({ name: "dlcount.png", mimeType: "image/png", buffer: PNG_1x1 });
    await page.getByRole("button", { name: /upload evidence/i }).click();
    await expect(page.locator(".ev-name", { hasText: "dlcount.png" })).toBeVisible();
    await expect(page.locator(".ev-card").filter({ hasText: "dlcount.png" }).locator(".ev-dl")).toContainText("⬇ 0");

    // Trigger a download via the card's download link (logs evidence.downloaded).
    const href = await page.locator(".ev-card").filter({ hasText: "dlcount.png" }).getByRole("link", { name: /download/i }).getAttribute("href");
    const resp = await page.request.get(href!);
    expect(resp.status()).toBeLessThan(400);

    await page.goto(url); // reload finding
    await expect(page.locator(".ev-card").filter({ hasText: "dlcount.png" }).locator(".ev-dl")).toContainText("⬇ 1");
  });
});
