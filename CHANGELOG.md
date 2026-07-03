# Changelog — JectarOne Client Portal

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
