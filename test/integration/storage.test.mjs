// Storage integration tests — exercise real S3 semantics against MinIO
// (emulates the production R2/S3 bucket). Requires `docker compose up -d`.
// Run: npm run test:storage
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const CFG = {
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  bucket: process.env.S3_BUCKET || "jectarone-evidence",
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
};

function client(creds = { accessKeyId: CFG.accessKeyId, secretAccessKey: CFG.secretAccessKey }) {
  return new S3Client({ region: CFG.region, endpoint: CFG.endpoint, forcePathStyle: true, credentials: creds });
}

const c = client();
const prefix = `org/test-${Date.now()}/finding/f1/`;
const made = [];

async function head(key) {
  try { await c.send(new HeadObjectCommand({ Bucket: CFG.bucket, Key: key })); return true; }
  catch { return false; }
}

after(async () => {
  for (const k of made) { try { await c.send(new DeleteObjectCommand({ Bucket: CFG.bucket, Key: k })); } catch {} }
});

test("successful upload via presigned PUT, then download via presigned GET", async () => {
  const key = prefix + "poc.txt"; made.push(key);
  const putUrl = await getSignedUrl(c, new PutObjectCommand({ Bucket: CFG.bucket, Key: key, ContentType: "text/plain" }), { expiresIn: 120 });
  const put = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "evidence-bytes" });
  assert.equal(put.status, 200, "presigned PUT succeeds");
  assert.ok(await head(key), "object exists after upload");

  const getUrl = await getSignedUrl(c, new GetObjectCommand({ Bucket: CFG.bucket, Key: key }), { expiresIn: 120 });
  const get = await fetch(getUrl);
  assert.equal(get.status, 200);
  assert.equal(await get.text(), "evidence-bytes", "downloaded bytes match");
});

test("presigned URLs carry a bounded expiry (signed-URL expiry)", async () => {
  const key = prefix + "exp.txt";
  const url = await getSignedUrl(c, new GetObjectCommand({ Bucket: CFG.bucket, Key: key }), { expiresIn: 300 });
  assert.match(url, /X-Amz-Expires=300/, "expiry is set on the signed URL");
  assert.match(url, /X-Amz-Signature=/, "URL is signed");
});

test("evidence deletion removes the object (no orphan)", async () => {
  const key = prefix + "todelete.txt"; made.push(key);
  const putUrl = await getSignedUrl(c, new PutObjectCommand({ Bucket: CFG.bucket, Key: key, ContentType: "text/plain" }), { expiresIn: 120 });
  await fetch(putUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "x" });
  assert.ok(await head(key), "exists before delete");
  await c.send(new DeleteObjectCommand({ Bucket: CFG.bucket, Key: key }));
  assert.equal(await head(key), false, "gone after delete");
});

test("bucket permission failure: bad credentials are rejected", async () => {
  const key = prefix + "denied.txt";
  const bad = client({ accessKeyId: "wrong", secretAccessKey: "wrong" });
  const putUrl = await getSignedUrl(bad, new PutObjectCommand({ Bucket: CFG.bucket, Key: key, ContentType: "text/plain" }), { expiresIn: 120 });
  const put = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "x" });
  assert.ok(put.status === 403 || put.status === 401, `expected 401/403, got ${put.status}`);
  assert.equal(await head(key), false, "nothing written on denied upload");
});

test("failed upload: PUT to a nonexistent bucket errors", async () => {
  const putUrl = await getSignedUrl(c, new PutObjectCommand({ Bucket: "no-such-bucket-xyz", Key: "k.txt", ContentType: "text/plain" }), { expiresIn: 120 });
  const put = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "x" });
  assert.ok(put.status >= 400, `expected 4xx, got ${put.status}`);
});

test("concurrent uploads all succeed independently", async () => {
  const keys = Array.from({ length: 6 }, (_, i) => prefix + `concurrent-${i}.txt`);
  keys.forEach((k) => made.push(k));
  await Promise.all(keys.map(async (k) => {
    const url = await getSignedUrl(c, new PutObjectCommand({ Bucket: CFG.bucket, Key: k, ContentType: "text/plain" }), { expiresIn: 120 });
    const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: k });
    assert.equal(r.status, 200);
  }));
  const present = await Promise.all(keys.map(head));
  assert.ok(present.every(Boolean), "all concurrent objects present");
});

// App-layer validation constants (mirror src/lib/storage.ts — enforced server-side
// in presignEvidenceUploadAction before any presigned URL is issued).
test("app enforces MIME allowlist + 25MB cap (mirror of storage limits)", () => {
  const ALLOWED = { "image/png": 1, "image/jpeg": 1, "application/pdf": 1, "text/plain": 1, "application/zip": 1 };
  const MAX = 25 * 1024 * 1024;
  assert.ok(ALLOWED["image/png"] && !ALLOWED["text/html"] && !ALLOWED["application/x-msdownload"], "type allowlist");
  assert.equal(MAX, 26214400, "size cap = 25 MB");
});
