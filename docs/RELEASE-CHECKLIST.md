# Release checklist — v1.0.0-beta

Sign-off gate before onboarding paying customers. Covers both apps.
Check every box; **do not ship with any Critical/High unchecked.**

## Code / merge / deploy
- [ ] Sprint 10 branch (`sprint-10-release-blockers`) merged to `main`.
- [ ] `main` pushed; Vercel deploy is green and points at the merge commit.
- [ ] `npm test` (unit) + `npm run test:storage` (MinIO) + `npm run test:e2e` all green on the release commit.
- [ ] `git log origin/main..HEAD` is empty (prod == GitHub).

## Database
- [ ] `prisma migrate deploy` run against production → `0003_email_verify_reset` applied.
- [ ] Verify the backfill grandfathered existing users: `SELECT count(*) FROM "User" WHERE "emailVerifiedAt" IS NULL;` → **0**.
- [ ] Neon PITR / automated backups enabled; a **test restore** performed once and documented.

## Environment variables (Vercel — production)
- [ ] `DATABASE_URL` (Postgres, `sslmode=require`)
- [ ] `AUTH_SECRET` (48+ random bytes; not the dev value)
- [ ] `APP_URL="https://portal.jectar.one"`  ← email links break without this
- [ ] `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM`
- [ ] `S3_BUCKET` / `S3_REGION=auto` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT` (R2)
- [ ] `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`

## Email (transactional)
- [ ] Send a real verification email end-to-end (sign up a test account) → link works → account activates.
- [ ] Send a real reset email → link works → password changes → old password rejected.
- [ ] `EMAIL_FROM` domain has SPF/DKIM aligned (deliverability, not spam-foldered).

## Auth / authz (verified by E2E, re-confirm on prod)
- [ ] Login, logout, invalid-credentials, expired-session redirect, brute-force throttle.
- [ ] New signup is gated on email verification; existing users are not.
- [ ] Cross-org isolation: no other org's data on lists, direct URLs, or `/api/v1/*` (404).
- [ ] CLIENT role is read-only; server-side RBAC blocks mutations.

## Uploads (R2)
- [ ] R2 bucket is **private**; CORS limited to `https://portal.jectar.one`.
- [ ] Real browser upload → object in bucket → thumbnail → download → delete removes the object.
- [ ] Invalid MIME / >25 MB rejected before any presigned URL is issued.
- [ ] (Recommended) R2 lifecycle rule to expire orphaned objects from abandoned uploads.

## Reports
- [ ] PDF downloads for a large assessment within the Vercel function time limit.

## Monitoring / logging
- [ ] Sentry receiving events (trigger a test error) with alerting configured.
- [ ] `global-error` boundary renders + reports.

## Marketing site (jectar.one)  ✅ verified in production
- [x] Security headers present (HSTS, CSP, X-Frame-Options, nosniff, Referrer/Permissions-Policy).
- [x] `contact-form.log` → 403; internal `.md` docs → 403.
- [ ] Contact form sends a live email (SMTP mailbox reachable; password current).

## Accessibility / responsive
- [ ] axe clean on auth pages (automated). Manual pass on dashboard/finding/report pages.
- [ ] Mobile layout check on dashboard, finding detail, report download.

## Known follow-ups (not v1.0.0-beta blockers)
- Password reset does not revoke existing JWT sessions (7-day cookie stays valid until expiry). Acceptable for beta; add a `passwordChangedAt` session check post-beta.
- `LoginAttempt` / `Token` tables need a periodic cleanup job (rows are bounded per-user but accumulate).
- CI to run the test suites on every push.
