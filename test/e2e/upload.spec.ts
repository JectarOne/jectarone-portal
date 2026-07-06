import { test, expect, Page } from "@playwright/test";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { login, USERS } from "./helpers";
import { S3 } from "./db-env";

// 1x1 transparent PNG (valid image → generates a thumbnail).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const s3 = new S3Client({
  region: S3.region, endpoint: S3.endpoint, forcePathStyle: true,
  credentials: { accessKeyId: S3.accessKeyId, secretAccessKey: S3.secretAccessKey },
});

let storageUp = true;
test.beforeAll(async () => {
  try { await s3.send(new ListObjectsV2Command({ Bucket: S3.bucket, MaxKeys: 1 })); }
  catch { storageUp = false; }
});

async function objectsForFinding(fid: string): Promise<number> {
  const out = await s3.send(new ListObjectsV2Command({ Bucket: S3.bucket, Prefix: "org/" }));
  return (out.Contents ?? []).filter((o) => (o.Key ?? "").includes(`/finding/${fid}/`)).length;
}

async function newFinding(page: Page, title: string): Promise<string> {
  await page.goto("/dashboard/assessments/nw-web/findings/new");
  await page.getByLabel(/^title/i).fill(title);
  await page.getByRole("button", { name: /create finding/i }).click();
  await page.waitForURL(/\/findings\/(?!new$)[^/]+$/);
  const m = page.url().match(/\/findings\/([^/?#]+)/);
  return m![1];
}

async function upload(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.getByLabel(/^file/i).setInputFiles({ name, mimeType, buffer });
  await page.getByRole("button", { name: /upload evidence/i }).click();
}

test.describe("evidence upload (MinIO/S3)", () => {
  test.beforeEach(() => test.skip(!storageUp, "MinIO not running (docker compose up -d)"));

  test("real upload stores the object, renders a thumbnail, and is downloadable", async ({ page }) => {
    await login(page, USERS.consultant);
    const fid = await newFinding(page, "Upload OK " + Date.now());
    // Storage configured → the real uploader (file input) is shown.
    await expect(page.getByLabel(/^file/i)).toBeVisible();

    await upload(page, "screenshot.png", "image/png", PNG_1x1);
    await expect(page.locator(".ev-name", { hasText: "screenshot.png" })).toBeVisible();
    expect(await objectsForFinding(fid)).toBe(1); // object really landed in the bucket
    // Image evidence renders an inline thumbnail via a presigned GET.
    await expect(page.locator("img.ev-thumb-img")).toBeVisible();
    // Download entrypoint is present and points at the org-scoped evidence route.
    const dl = page.getByRole("link", { name: /download/i }).first();
    await expect(dl).toHaveAttribute("href", /\/api\/v1\/evidence\//);
  });

  test("invalid MIME type is rejected (no object written)", async ({ page }) => {
    await login(page, USERS.consultant);
    const fid = await newFinding(page, "Upload BadType " + Date.now());
    await upload(page, "malware.exe", "application/x-msdownload", Buffer.from("MZ..."));
    await expect(page.locator(".alert-error")).toContainText(/unsupported type/i);
    expect(await objectsForFinding(fid)).toBe(0);
  });

  test("oversized file is rejected client-side", async ({ page }) => {
    await login(page, USERS.consultant);
    const fid = await newFinding(page, "Upload TooBig " + Date.now());
    const big = Buffer.alloc(26 * 1024 * 1024, 1); // 26 MB > 25 MB cap
    await upload(page, "huge.png", "image/png", big);
    await expect(page.locator(".alert-error")).toContainText(/25 MB/i);
    expect(await objectsForFinding(fid)).toBe(0);
  });

  test("deleting evidence removes the stored object (orphan regression)", async ({ page }) => {
    await login(page, USERS.consultant);
    const fid = await newFinding(page, "Upload Delete " + Date.now());
    await upload(page, "todelete.png", "image/png", PNG_1x1);
    await expect(page.locator(".ev-name", { hasText: "todelete.png" })).toBeVisible();
    expect(await objectsForFinding(fid)).toBe(1);

    await page.locator(".ev-card").filter({ hasText: "todelete.png" }).getByRole("button", { name: /remove/i }).click();
    await expect(page.locator(".ev-name", { hasText: "todelete.png" })).toHaveCount(0);
    expect(await objectsForFinding(fid)).toBe(0); // object gone from the bucket, not orphaned
  });

  test("multiple uploads on one finding all persist", async ({ page }) => {
    await login(page, USERS.consultant);
    const fid = await newFinding(page, "Upload Multi " + Date.now());
    await upload(page, "one.png", "image/png", PNG_1x1);
    await expect(page.locator(".ev-name", { hasText: "one.png" })).toBeVisible();
    await upload(page, "two.png", "image/png", PNG_1x1);
    await expect(page.locator(".ev-name", { hasText: "two.png" })).toBeVisible();
    expect(await objectsForFinding(fid)).toBe(2);
  });
});
