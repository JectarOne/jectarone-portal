# Changelog — JectarOne Client Portal

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
