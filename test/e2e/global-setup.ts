import { execSync } from "node:child_process";
import { DB_URL, AUTH_SECRET } from "./db-env";

// Reset + reseed the database before the E2E run so every run starts from a
// known, production-shaped state. Requires the Postgres from docker-compose.yml.
export default async function globalSetup() {
  const env = { ...process.env, DATABASE_URL: DB_URL, AUTH_SECRET };
  console.log("[e2e] migrating + seeding test database…");
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("node prisma/seed.mjs", { env, stdio: "inherit" });
}
