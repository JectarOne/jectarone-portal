# Changelog — JectarOne Client Portal

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
