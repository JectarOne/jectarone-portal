# Release process

Environments: **preview/staging** (auto on `main`) → **production** (approval-gated).

## Pipelines
- **CI** (`ci.yml`) — every PR + push to `main`: type-check, lint, unit tests,
  build (with a Postgres service), and full Playwright E2E (Postgres + MinIO).
- **CodeQL** (`codeql.yml`) + **Secret scan** (`secret-scan.yml`, gitleaks) —
  every PR + weekly. Enable GitHub native secret scanning + **push protection**
  in Settings → Code security.
- **Deploy staging** (`deploy-staging.yml`) — Vercel preview on each `main` push.
- **Release** (`release.yml`) — a `vX.Y.Z` tag creates a GitHub Release (auto
  notes; `-beta`/`-rc` marked pre-release).
- **Deploy production** (`deploy-production.yml`) — triggered by publishing the
  Release; **pauses for manual approval** (the `production` Environment must have
  required reviewers), runs `prisma migrate deploy` via the build, deploys
  `--prod`, then smoke-checks `/api/health`.

## Required GitHub config (one-time)
- Environments: `staging`, and `production` **with required reviewers**.
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PROD_DATABASE_URL`.
- Branch protection on `main`: require CI + CodeQL to pass, require review.

## Cutting a release
1. Merge PRs to `main` (CI green). Staging deploys automatically — smoke-test it.
2. Update `CHANGELOG.md`; bump the version.
3. Tag + push:
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
4. `release.yml` creates the GitHub Release → `deploy-production.yml` starts and
   **waits for approval**.
5. Approve. Confirm the post-deploy health check is green and Sentry is quiet.
6. If it fails or regresses → **docs/ROLLBACK.md**.

## Pre-release gate
See `docs/RELEASE-CHECKLIST.md` (env vars, migrations, backups, monitoring, uploads).
