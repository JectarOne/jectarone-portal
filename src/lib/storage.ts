import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Evidence file storage on S3 (or any S3-compatible service via S3_ENDPOINT:
// Cloudflare R2, MinIO, DigitalOcean Spaces, etc). Entirely optional — when the
// env is not configured the app falls back to evidence-metadata-only mode.

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION || "us-east-1";
const ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const ENDPOINT = process.env.S3_ENDPOINT; // optional (S3-compatible providers)

export function storageConfigured(): boolean {
  return Boolean(BUCKET && ACCESS_KEY && SECRET_KEY);
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
      ...(ENDPOINT ? { endpoint: ENDPOINT, forcePathStyle: true } : {}),
    });
  }
  return _client;
}

/** Deterministic, tenant-scoped object key. */
export function evidenceKey(orgId: string, findingId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/\.{2,}/g, "_").replace(/^[._-]+/, "").slice(0, 120) || "file";
  const rand = Math.random().toString(36).slice(2, 10);
  return `org/${orgId}/finding/${findingId}/${Date.now()}-${rand}-${safe}`;
}

/** Presigned PUT URL for a direct browser upload (short-lived). */
export async function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), { expiresIn: 300 });
}

/** Presigned GET URL for download/preview (short-lived). */
export async function presignDownload(key: string, downloadName?: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ...(downloadName ? { ResponseContentDisposition: `attachment; filename="${downloadName.replace(/[^a-zA-Z0-9._-]+/g, "_")}"` } : {}),
    }),
    { expiresIn: 300 }
  );
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // best-effort; a leftover object is acceptable, a crash is not
  }
}

/** Whitelisted upload types (spec §6: PNG, JPG, PDF, TXT, ZIP). */
export const ALLOWED_EVIDENCE_TYPES: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "application/pdf": "PDF",
  "text/plain": "TXT",
  "application/zip": "ZIP",
};
export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024; // 25 MB
