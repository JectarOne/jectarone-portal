# Changelog — JectarOne Client Portal

## Sprint 10 — Release Blockers (2026-07-05, branch `sprint-10-release-blockers`)

Closes the launch blockers for v1.0.0-beta. No new product features beyond the
account-lifecycle flows required to onboard paying customers.

### Added
- **Transactional email** (`src/lib/email.ts`): authenticated SMTP via nodemailer
  when configured; in dev/test without SMTP, messages are written to
  `.mail-outbox/` (so flows are testable). **Fails loudly in production if SMTP is
  unset** — reset/verification cannot silently no-op.
- **Email verification.** New signups receive a verification link; the dashboard
  is gated on `User.emailVerifiedAt` until confirmed. Resend supported. Existing
  accounts are grandfathered by the migration backfill (only new users must verify).
- **Password reset.** `/forgot-password` (non-enumerating, IP-throttled) emails a
  single-use, 1-hour, hashed token; `/reset-password` sets the new hash and
  invalidates pending tokens. `Forgot your password?` link added to login.
- **Tokens** (`src/lib/token.ts`, `Token` model, migration `0003`): SHA-256-hashed,
  single-use, TTL'd (verify 24h / reset 1h); only the hash is stored.
- **Sentry** (`@sentry/nextjs`): server/edge/client instrumentation, **inert unless
  `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` is set**. Added `global-error` boundary
  (reports + friendly UI) and a custom `not-found` page.
- `.env.example` rewritten (Postgres default, `APP_URL`, SMTP, Sentry, S3/R2);
  `docs/RELEASE-CHECKLIST.md` (v1.0.0-beta sign-off gate).

### Tests
- Unit: token hashing (sha256, deterministic, distinct) + expiry.
- E2E (`test/e2e/account.spec.ts`): signup gated → verify link → dashboard;
  invalid token rejected; forgot → reset → login with new password (old rejected);
  reset token is single-use; forgot-password does not reveal account existence.
  Uses the dev mail outbox to capture tokens.

### Production verification (this sprint)
- **jectar.one**: security headers present in prod; `contact-form.log` + internal
  `.md` docs return **403**. Marketing-site blockers confirmed resolved live.
- **portal**: `main` (sprints 7–9) is deployed and matches GitHub. This branch
  adds the account flows; deploy + run `prisma migrate deploy` per the checklist.

### Known follow-ups (documented, not beta blockers)
- Reset does not revoke existing JWT sessions (7-day cookie). Add `passwordChangedAt`
  session check post-beta.
- `Token`/`LoginAttempt` cleanup job; CI to gate deploys.

## Sprint 9 — Storage & Production Validation (2026-07-05, branch `sprint-9-storage`)

Validated the evidence upload/storage flow end to end against MinIO (emulates the
production Cloudflare R2 bucket).

### Bugs fixed (found by the new tests)
- **Deleted evidence left the S3 object orphaned.** `deleteEvidenceAction`
  soft-deleted the DB row but never removed the backing file — a storage leak and
  a data-retention problem for sensitive evidence. It now calls
  `deleteObject(storageKey)` (best-effort) when storage is configured.
  Regression: the upload E2E asserts the object is gone from the bucket after
  deletion.
- **The strict CSP broke `next dev` and local S3 uploads.** `next dev` uses
  `eval()` for HMR, so with no `'unsafe-eval'` the evidence uploader's client
  `onSubmit` silently died (uploads never fired); and MinIO's `http://localhost:9000`
  was blocked by `connect-src`/`img-src` (`'self' https:`), breaking the presigned
  PUT and image thumbnails. `buildCsp()` now applies these relaxations **in
  development only** (plus an explicit http endpoint for self-hosted non-dev
  deploys). **Production R2 is https and stays strict** — no `'unsafe-eval'`, no
  localhost — covered by a unit test.

### Added
- **MinIO** in `docker-compose.yml` (S3-compatible) with an auto-created private
  `jectarone-evidence` bucket; CORS works for browser presigned PUTs.
- **Storage integration tests** (`npm run test:storage`, `test/integration/`):
  presigned PUT+GET round-trip, signed-URL expiry, delete, bad-credential
  permission failure, nonexistent-bucket failure, concurrent uploads, MIME/size
  limits — against real MinIO.
- **Browser upload E2E** (`test/e2e/upload.spec.ts`): successful upload lands the
  object + renders a thumbnail + download link; invalid MIME and >25 MB rejected
  (no object written); evidence delete removes the object (regression); multiple
  uploads persist. Verifies bucket state directly via aws-sdk.
- `docs/R2-VERIFICATION.md` — scripted checklist to run the identical flow
  against a **staging** R2 bucket.

### Not done (and why)
- **The production R2 bucket was NOT exercised by the agent** — no R2 credentials
  here, and the tests write/delete objects, which must never run against the live
  evidence bucket. `docs/R2-VERIFICATION.md` provides the exact env + commands to
  verify against a staging R2 bucket; the code path is identical (R2 is S3-compatible).
- **Orphaned uploads from abandoned sessions** (presigned PUT succeeds, browser
  never registers) are inherent to direct-to-S3 uploads; mitigate with an R2
  lifecycle rule / reconciliation job (documented in R2-VERIFICATION.md). The
  delete path itself is now clean.

## Sprint 8 — Authenticated Production QA (2026-07-05, branch `sprint-8-qa`)

Full end-to-end validation of the authenticated app against a seeded Postgres
that mirrors production.

### Bug fixed (found by E2E)
- **Creating or editing a finding through the UI failed with a Zod error**
  (`Expected 'Open' | … received null`). The finding form never submits a
  `status` field (status is workflow-managed), so `formData.get("status")` is
  `null`; `z.enum(...).default("Open")` only fills for `undefined`, not `null`.
  The bug was masked because the seed wrote findings directly via Prisma.
  Fix: `findingSchema.status` now preprocesses `null`/`""` → `undefined` so the
  default applies (`src/lib/validation.ts`). Regression coverage: the
  `findings › create` E2E now exercises the real form. **One logical fix commit.**

### Reproducible database
- `docker-compose.yml` — Postgres 16 on `:5433` with a named volume + healthcheck.
- `prisma/seed.mjs` (`npm run db:seed`) — two orgs (Northwind, Globex),
  OWNER/MEMBER(analyst)/CLIENT users, assessments in every status incl. archived,
  findings of every severity (with CVSS/CWE/OWASP) plus an overdue one, assets,
  evidence, comments, and activity history. Stable ids (`nw-web`, `gx-web`,
  `gx-secret`) anchor cross-org tests. Scripts: `db:migrate`, `db:seed`, `db:reset`.

### Playwright E2E (authenticated)
Global setup migrates + reseeds before each run; serial (one DB). Coverage:
- **Auth**: login, logout, invalid credentials, session-required redirect,
  forged **expired-token** rejection, **brute-force throttle**.
- **Assessments**: create, edit, status filter, archived filter, archive toggle,
  admin-only delete (consultant blocked).
- **Findings**: create, status transition + history/timeline, comment, evidence
  metadata, CVSS badge + severity, search + filter.
- **Assets**: create, edit, archive filter, admin-only delete.
- **RBAC / isolation**: no cross-org data on lists; cross-org direct-URL access
  renders no data; CLIENT is read-only (no mutate controls); other org sees only
  its own data.
- **Reports**: PDF download (`application/pdf` + attachment), audit row written.
- **Security**: security headers/CSP present, `X-Powered-By` absent, API 401
  without session, API org-scoped + cross-org object → 404, session cookie
  `HttpOnly`+`SameSite=Lax`, CLIENT mutation rejected server-side.

### Notes
- E2E runs against `next dev` so session cookies stay non-Secure over
  `http://127.0.0.1` (a production build sets Secure cookies the API client won't
  send over http). `retries: 2` absorbs `next dev` first-hit route compilation.
- Cross-org direct URLs return HTTP 200 (not 404) because `notFound()` runs
  inside a streamed server component (a `loading.tsx` is present); **no data
  leaks** — verified by asserting the absence of the other org's content.

## Sprint 7 — Production Readiness & UX Polish (2026-07-04, branch `sprint-7-polish`)

Accessibility, UX, and consistency pass. Each item is its own commit; `npm test`
(23 unit) + `npm run test:e2e` (Playwright + axe on the public auth pages) pass,
`tsc --noEmit` clean. No existing functionality or data logic changed.

### Accessibility (WCAG AA)
- Visible keyboard focus (`:focus-visible`) on buttons, links, nav, and filter
  chips; inputs keep their existing focus ring. `prefers-reduced-motion` honored.
- **Skip-to-content** link as the first focusable element in the dashboard shell;
  `<main id="main">` target; sidebar wrapped in a `<nav aria-label="Primary">`.
- Prose links (auth footer, comment bodies) underlined so they are distinguishable
  by more than color — fixes an axe WCAG 1.4.1 contrast finding (1.19:1 link vs text).

### UX / consistency
- **Active nav highlight**: the sidebar now marks the current route (`aria-current`
  + `.active`) — the style existed but was never applied. Initials **avatar** by
  the signed-in user.
- **Loading skeletons** (`loading.tsx`) for every dashboard route — overview
  metrics/distributions and page/table skeletons — as Next Suspense fallbacks.
- **CVSS badges** color-coded by CVSS v3 band in the findings list; **CWE/OWASP/
  MITRE** metadata pill primitive; reusable **EmptyState** with context-aware copy.

### Security (verified)
- Re-verified: security headers + CSP, RBAC/org-scoping on every route/action,
  S3 upload allowlist, login throttle — all intact (see Security Hardening below).
- Fixed a CSP gap: `style-src`/`font-src` now allow the Google Fonts origins so
  the web font is not blocked once CSP is enforced (regression-tested).

### Testing
- Playwright E2E (desktop + mobile) on `/login` and `/signup` with `@axe-core`
  WCAG 2.0/2.1 A/AA gating; unit mirrors for `cvssBand` and `initials`.
- Authenticated dashboard E2E still needs a seeded Postgres and is out of scope
  for this environment (documented in README "Testing").

### Deferred (not in this pass)
- Deeper per-page work (assessment timeline visuals, evidence gallery grid,
  asset tags/pagination, team invitations/role-management UI) — the data layer
  already supports these; they are UI build-outs for a follow-up.

## Security Hardening (2026-07-04, branch `security-hardening`)

Audit remediation on top of Sprint 6. Each fix is its own commit with tests;
`node --test` (all green) and `tsc --noEmit` (clean) pass. No functionality
changed; RBAC/org-scoping/S3 flows preserved.

### Fixed
- **`M1`/`L1` (High) — security response headers.** `next.config.mjs` set no
  security headers and leaked `X-Powered-By: Next.js`. Added a per-route header
  set — **CSP** (`frame-ancestors 'none'` clickjacking protection, `object-src
  'none'`, `base-uri`/`form-action 'self'`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `HSTS` — and `poweredByHeader: false`. CSP is tuned to keep Next's inline
  hydration bootstrap, inline styles, and direct-to-S3 presigned upload/
  thumbnail flows working (`img-src`/`connect-src https:`).
- **Login brute-force (High).** Self-rolled auth had no rate limiting. Added a
  serverless-safe `LoginAttempt` table + sliding-window throttle: per-email (5)
  and per-IP (20) over 15 min, evaluated before any DB/bcrypt work and
  independent of account existence (no enumeration). Failures recorded; cleared
  on success. `src/lib/rate-limit.ts`, wired in `loginAction`.
  Shipped as migration `0002_add_login_attempt`; the Vercel build's
  `prisma migrate deploy` applies it. A pre-existing (db-push) production DB
  must be baselined once with `prisma migrate resolve --applied 0001_init`
  first (P3005 fix) — see README "One-time baseline". Never `db push` in prod.
- **Signup account enumeration (Medium).** Signup revealed whether an email is
  registered. Added a per-IP throttle so it can't be used to enumerate at scale;
  probes count toward the IP cap. Full non-enumerable signup requires an email-
  verification flow (see `docs/PORTAL-SECURITY-FIXES.md`).

### Tests added
- `test/security.test.mjs` — asserts the header set + values, that CSP still
  permits S3 presigned flows and Next hydration, `poweredByHeader` off, and the
  throttle cap + `x-forwarded-for` parsing logic.

### Reviewed and found already correct (no change)
- **JWT/session:** HS256 with explicit `algorithms` allowlist (no `alg:none`),
  `AUTH_SECRET` length check, `httpOnly`/`secure`/`sameSite=lax` cookie, DB
  membership re-load on every request.
- **AuthZ / IDOR:** every API route and server action re-checks
  `organizationId === session.orgId` and RBAC (`hasRole`) before read/mutate;
  evidence storage keys re-verified against the org namespace.
- **XSS:** comment Markdown renderer escapes first, then applies a closed inline
  subset; links restricted to `http(s)`. **CSRF:** `sameSite=lax` + POST-only
  mutations. **SSRF/upload:** S3 type + 25 MB allowlist, private bucket, short-
  lived presigned URLs. Password hashing bcrypt (12 rounds).

### Known gaps (documented, need product decisions / infra)
- No email-verification or password-reset flow (needs a mailer) — see
  `docs/PORTAL-SECURITY-FIXES.md`.
- `M2` CORS `ACAO: *` was observed on the static login HTML (Vercel CDN
  artifact), not set by any route; API routes are same-origin. Verify/remove at
  the Vercel layer.

## Sprint 6 — Evidence File Storage (2026-07-02)
- Real evidence file upload/download/preview on **S3 (or S3-compatible)** — closes the Sprint 5 deferral. **No schema change** (uses the `Evidence.storageKey` column reserved in Sprint 3).
- **Direct-to-S3 presigned uploads**: `presignEvidenceUploadAction` (MEMBER+, org-scoped, type + 25 MB checks) → browser PUTs the file straight to S3 → `registerEvidenceAction` records metadata + storageKey (re-verifies the key is in the caller's org namespace). App server never handles the bytes.
- **Download/preview**: `GET /api/v1/evidence/:eid` redirects to a short-lived presigned GET (org-scoped); image evidence shows inline thumbnails via server-generated presigned URLs. Bucket stays private.
- **Provider-agnostic** (`src/lib/storage.ts`): AWS S3 or R2/MinIO/Spaces via optional `S3_ENDPOINT`. Allowed: PNG/JPG/PDF/TXT/ZIP.
- **Graceful fallback**: unset S3 env → evidence-metadata-only mode (Sprint 5 behavior), no breakage.
- Env + required bucket CORS documented in `.env.example`. Tests: evidence type allowlist + org-namespaced/sanitized key (16/16 passing). Build + TS strict + lint pass.
- **Note:** the S3 upload path could not be runtime-tested here (no bucket credentials in this environment) — set the S3 env vars + bucket CORS and verify a live upload on the deployed app.


## Sprint 5 — Vulnerability Management Workflow (2026-07-02)
- **Status workflow + history**: Open/InProgress/ReadyForValidation/Resolved/AcceptedRisk/FalsePositive with enforced transitions; each change is an immutable ActivityLog entry (prev → new, user, time). Sets resolvedAt/validatedAt. Legacy Fixed/Verified still accepted → **no breaking change / no data migration**.
- **Assignment**: assignee/assignedBy/assignedAt; only same-org members assignable; tracked in the timeline.
- **SLA**: `computeDueDate()` per severity (7/30/60/90 days; Informational none), auto-set on create, recomputed on severity change unless overridden; overdue detection + dashboard counters + list filter.
- **Risk acceptance**: reason + optional expiry + acceptedBy/at; reopenable; surfaced separately on the dashboard.
- **Comments**: new `FindingComment` model — Markdown (XSS-safe renderer), @mentions, edit + soft-delete own (ADMIN can remove any).
- **Evidence**: added `deletedAt` (soft delete).
- **Dashboard analytics**: Open/Closed/Overdue/Accepted/Critical/High/Average CVSS/**MTTR**/created & resolved this month + severity/status distribution bars.
- **Roles**: added `CLIENT` (rank 0, read-only) below MEMBER (= "Security Analyst"); mutations gate at MEMBER+, so CLIENT is read-only site-wide.
- **REST API** (`/api/v1/*`, session-auth'd, org-scoped): findings list, finding detail (+timeline+comments), status update, comments GET/POST, dashboard metrics.
- Tests: SLA calc, overdue rule, status transitions, Markdown safety (14/14 passing). Neon synced; migration SQL regenerated.
- **Model reuse (backward compat):** the spec's `FindingActivity`/`FindingEvidence` are served by the existing `ActivityLog`/`Evidence` (Evidence got soft delete) rather than duplicate models — Sprint 4 data untouched.
- **Honest deferrals** (need infra/next sprint): evidence **binary upload/download/preview** (no object storage yet — metadata only); **line-chart** trends (§9 "findings over time / resolution trend") reduced to created/resolved-this-month counters + distribution bars; @mention **notifications** not delivered (mentions parsed + highlighted only); REST endpoints for assignment/timeline/evidence/risk-acceptance follow the same pattern but the UI drives those via server actions.
- Verified: build + TS strict + lint + 14/14 tests; e2e vs Postgres (assignment, resolvedAt, accepted-risk fields, comment + evidence soft-delete filtering, cross-org isolation, timeline, cascade delete of comments/evidence) all pass.


## Sprint 4 — Assets, Reports & PDF Export (2026-07-02)
- Models: `Asset` (org-scoped inventory; type/identifier/notes, soft-archive) with an
  optional, additive `Finding.assetId` link (SetNull on delete — existing free-text
  `affectedAsset` field untouched, no breaking change to Sprint 3 data); `Report`
  (audit log of PDF generations — title, finding-count snapshot, generatedBy, timestamp).
- **PDF export**: `GET /dashboard/assessments/[id]/report` Route Handler renders a
  branded, multi-page PDF live from current DB data via `@react-pdf/renderer`
  (self-hosted, no external service) — cover page, executive summary, severity
  breakdown, findings table, detailed findings, confidential footer. Each generation
  writes a `Report` row + an activity-log entry.
- Asset CRUD + archive/restore (MEMBER+), delete (ADMIN+) — same pattern as
  Assessments/Findings; asset picker added to the Finding form.
- **Dev tooling fix**: added the missing ESLint flat config (`eslint.config.mjs`) — no
  config previously existed, so `next lint` had never actually run; earlier sprints'
  "lint pass" claims were unverified. Pinned `eslint-config-next` to the Next 15 major
  (a `next@16` version had been installed by default, causing a circular-reference
  crash with ESLint 9). Fixed the one real lint error it found (unescaped apostrophe,
  pre-existing since Sprint 1).
- Tests: asset type membership, severity-count aggregation (10/10 passing).
- Docs: ARCHITECTURE.md, README.md, ERD.md updated.
- Verified: build + TS strict + **lint** (now genuinely passing) all green; e2e against
  Postgres — asset CRUD, cross-org isolation, finding↔asset link, asset delete → finding
  survives with `assetId` SetNull, report log + cross-org isolation, cascade delete
  (assessment → reports); separately, the PDF component was rendered directly
  (`@react-pdf/renderer` `renderToBuffer`) and verified with `pypdf`: valid PDF, 3 pages,
  correct client name/brand/finding content.


## Sprint 3 — Findings & Evidence System (2026-07-02)
- Models: `Finding` (severity/likelihood/impact/CVSS/OWASP/CWE/MITRE/asset/status, soft-archive), `Evidence` (metadata; `storageKey` reserved for future cloud storage), `ActivityLog` (audit trail, SetNull refs so it survives deletion). Indexes on organizationId/assessmentId/severity/status/createdAt/cvssScore.
- Risk matrix: Risk = Likelihood × Impact (5×5, banded) with a rendered matrix + risk badges; severity/status colored badges.
- Server actions (zod + RBAC + org-scope): finding create/update/archive/restore/delete (ADMIN+ delete); evidence add/remove (ownership-checked). All mutations write an activity-log entry.
- UI: assessment page = Overview → Findings table (search/filter/sort) → Activity; finding detail with risk matrix, classification, evidence, inline edit; global `/dashboard/findings`; dashboard metrics (Open/Critical/High/Resolved/Average Risk).
- Schema pushed to Postgres; baseline migration SQL regenerated; ERD added (`docs/ERD.md`).
- Tests: finding enum membership, risk-matrix banding, CVSS range (8/8 passing).
- Verified: build + TS strict + lint pass; e2e against Postgres — create finding+evidence, cross-org isolation, update, archive, cascade delete (assessment → findings + evidence), and audit-log survival with null refs all pass.


## Sprint 2 — Assessment Management (2026-07-02)
- Added `Assessment` model (org-scoped; type/status as validated strings; `createdBy`, `archivedAt`, timestamps; indexes on `[organizationId, status]` and `[organizationId, archivedAt]`).
- Server actions: create, update, archive/unarchive, delete — all zod-validated and RBAC-guarded (MEMBER+ create/edit/archive; ADMIN+ delete); every action verifies `organizationId` scope.
- UI: assessments list with status filters + archived view, create form, detail/edit page with archive + delete; dashboard nav + metrics updated.
- Replaces the client-side Report Builder workflow with persisted, multi-user, tenant-scoped data.
- Baseline migration SQL at `prisma/migrations/0001_init/migration.sql`; schema synced to Postgres via `prisma db push`.
- Tests: added assessment type/status membership + date-range rule (5/5 passing).
- Docs: ARCHITECTURE.md + README.md updated.
- Verified: build + TypeScript strict + lint pass; e2e against Postgres — create, cross-org isolation, update, archive, `createdBy` relation all pass.

## Sprint 1 — Auth, Organizations, Multi-tenancy, User Management (2026-07-01)
- Self-rolled JWT session auth (jose + bcryptjs); signup/login/logout; edge middleware gates `/dashboard`.
- Organizations + multi-tenancy (`Membership` join, role strings); user management with RBAC and last-owner guard.
- Dashboard shell; tests for RBAC + slugify.
