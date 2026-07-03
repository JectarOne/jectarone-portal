# JectarOne Client Portal — Architecture (Phase 3)

Approved direction: a **Client Portal** (not a real EDR) on **new app hosting**, separate from the
static marketing site. This is the frozen architecture for Sprint 1+ (per the Execution Guide).

## Stack
- **Next.js 15 (App Router) + TypeScript** — one deployable app, server components + server actions.
- **Prisma ORM** — SQLite for local dev (zero-setup), **PostgreSQL in production** (Neon/Supabase). Schema is portable (no DB-specific enums; roles are validated strings).
- **Auth: self-rolled, minimal, robust** — bcrypt password hashing (`bcryptjs`) + a signed JWT session (`jose`) in an httpOnly, secure, sameSite cookie. Chosen over Auth.js v5 (beta) for control and fewer moving parts.
- **Validation:** `zod` on every server action.
- **Styling:** plain CSS with the JectarOne brand tokens (same palette as the marketing site) — no Tailwind, fewer build moving parts.
- **Tests:** Node's built-in `node:test` (no extra runner) for unit-testing auth/RBAC utilities.

## Hosting / deployment
- **App:** Vercel (or any Node host), served from `app.jectar.one`.
- **DB:** managed Postgres (Neon free tier is fine to start).
- Marketing site stays on cPanel, unchanged. The two are independent.

## Multi-tenancy model
Row-level tenancy scoped by `organizationId`. A user can belong to multiple organizations via `Membership`. The session carries the active `organizationId`; every tenant-scoped query filters by it.

## Data model
```
User         id, email(unique), name, passwordHash, createdAt
Organization id, name, slug(unique), createdAt
Membership   id, userId → User, organizationId → Organization,
             role ("OWNER" | "ADMIN" | "MEMBER"), createdAt
             @@unique([userId, organizationId])

# Sprint 2
Assessment   id, organizationId → Organization (cascade),
             clientName, type, status ("Draft"|"InProgress"|"Review"|"Delivered"),
             scope?, startDate?, endDate?, leadConsultant?,
             executiveSummary?, notes?,
             createdById → User? (setNull), archivedAt?, createdAt, updatedAt
             @@index([organizationId, status]), @@index([organizationId, archivedAt])
```
`type` and `status` are validated strings (no DB enums → SQLite/Postgres portable + evolvable).
The Assessment model is deliberately the anchor for future sprints: **Finding, Evidence,
Asset, and Report** will each carry `assessmentId` (and `organizationId`) and attach without
altering Assessment. Soft-archive via `archivedAt`; hard delete is ADMIN+ only.

### Sprint 3 — Findings, Evidence, Activity Log
```
Finding      id, organizationId→Org(cascade), assessmentId→Assessment(cascade),
             title, description?, technicalDetails?, businessImpact?, remediation?,
             verificationSteps?, severity, likelihood, impact, cvssScore?, cvssVector?,
             cwe?, owaspCategory?, mitreTechnique?, affectedAsset?, affectedAssetType?,
             status, createdById→User?(setNull), archivedAt?, createdAt, updatedAt
             @@index [org,assessment] [org,severity] [org,status] [org,createdAt] [cvssScore]

Evidence     id, organizationId→Org(cascade), findingId→Finding(cascade),
             filename, mimeType, sizeBytes?, storageKey?(reserved), note?,
             uploadedById→User?(setNull), createdAt
             @@index [org] [finding]

ActivityLog  id, organizationId→Org(cascade), action, detail?,
             assessmentId→Assessment?(setNull), findingId→Finding?(setNull),
             userId→User?(setNull), createdAt
             @@index [org,createdAt] [assessment]
```
- **Severity:** Critical/High/Medium/Low/Informational. **Finding status:** Open/InProgress/Fixed/Verified/AcceptedRisk/FalsePositive.
- **Risk = Likelihood × Impact** (5×5, 1–25) banded → Critical/High/Medium/Low/VeryLow; rendered as a matrix on each finding.
- **CVSS** base score (0–10, validated) + vector string. **OWASP/CWE/MITRE** mapping fields.
- **Evidence** stores metadata now; `storageKey` reserved so cloud file storage attaches later with no migration.
- **Activity log** is an append-only audit trail; it uses SetNull refs so entries survive finding/assessment deletion.

Full diagram: see `docs/ERD.md`. Future sprints add: Asset, Report (tenant-scoped).

### RBAC on findings & evidence
- View: any member. Create / edit / archive / restore: MEMBER+. **Hard delete: ADMIN+.**
- Evidence add/remove: MEMBER+ (ownership checked via `organizationId`).
- Every action re-loads the session server-side and verifies `organizationId` (and assessment/finding ownership) before mutating.

## Replacing the client-side Report Builder
The static marketing site's `/app/` Report Builder (ephemeral, browser-only) is superseded
**inside the portal** by DB-backed Assessments: data now persists, is multi-user, org-scoped,
and RBAC-controlled. The public `/app/` tool stays live on the marketing site as a free
lead-gen utility; portal users work from `/dashboard/assessments`.

## RBAC
Roles: `OWNER > ADMIN > MEMBER`.
- OWNER: everything, incl. billing + delete org.
- ADMIN: manage members, assessments, reports.
- MEMBER: read + contribute to assessments.
Enforced server-side in every action via `requireRole(session, orgId, minRole)`.

## Auth flow
1. **Sign up** → creates `User` + `Organization` + `Membership(OWNER)` in a transaction, sets session cookie.
2. **Log in** → verify bcrypt hash → set session cookie `{ uid, oid }` (JWT, HS256, 7-day).
3. **Middleware** protects `/dashboard/*` by verifying the JWT signature at the edge (no DB call). Server components/actions re-load the user + membership from the DB for authorization.
4. **Log out** → clear cookie.

## Folder structure
```
src/
  app/
    layout.tsx, globals.css, page.tsx
    (auth)/login/page.tsx, (auth)/signup/page.tsx
    dashboard/layout.tsx, page.tsx, team/page.tsx
  actions/auth.ts, actions/team.ts     # "use server"
  lib/db.ts, auth.ts, password.ts, rbac.ts, validation.ts
  middleware.ts
prisma/schema.prisma
test/unit.test.mjs
```

## Definition of done (each feature)
Functional · validated (zod) · authorized (RBAC) · responsive · accessible · documented (README/CHANGELOG) · unit-tested where logic warrants.

## Sprint plan (frozen order)
- **Sprint 1 (done):** Auth, Organizations, Multi-tenancy, User Management.
- **Sprint 2 (done):** Assessment Management — CRUD + archive, org-scoped, RBAC-guarded, persisted (replaces the client-side Report Builder workflow).
- **Sprint 3 (done):** Findings & Evidence — CRUD + archive/restore, severity/risk/CVSS/OWASP/CWE/MITRE, evidence metadata, activity log, search/filter/sort, dashboard metrics.
- Sprint 4: Assets, Reports, PDF export.
- Later: notifications, audit logs, billing, API keys, developer docs.

## RBAC on assessments
- View / list: any member.
- Create / edit / archive: MEMBER+ (consultants do the work).
- Hard delete: ADMIN+ only (destructive).
All actions re-load the session server-side and verify `organizationId` scope before mutating.
