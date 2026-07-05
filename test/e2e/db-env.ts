// Shared local DB config for E2E (matches docker-compose.yml). Local only —
// not a production secret. Overridable via env for CI against another Postgres.
export const DB_URL =
  process.env.E2E_DATABASE_URL ||
  "postgresql://portal:portal@localhost:5433/jectarone?schema=public";
export const AUTH_SECRET =
  process.env.E2E_AUTH_SECRET || "local-dev-e2e-secret-do-not-use-in-prod-000000";
