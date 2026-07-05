// Shared local DB config for E2E (matches docker-compose.yml). Local only —
// not a production secret. Overridable via env for CI against another Postgres.
export const DB_URL =
  process.env.E2E_DATABASE_URL ||
  "postgresql://portal:portal@localhost:5433/jectarone?schema=public";
export const AUTH_SECRET =
  process.env.E2E_AUTH_SECRET || "local-dev-e2e-secret-do-not-use-in-prod-000000";

// S3 (MinIO from docker-compose.yml — emulates the production R2/S3 bucket).
export const S3 = {
  bucket: process.env.S3_BUCKET || "jectarone-evidence",
  region: process.env.S3_REGION || "us-east-1",
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
};
