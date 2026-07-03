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

Full diagram: see `docs/ERD.md`.

### Sprint 4 — Assets, Reports, PDF export
```
Asset    id, organizationId→Org(cascade), name, type, identifier?, notes?,
         createdById→User?(setNull), archivedAt?, createdAt, updatedAt
         @@index [org,type] [org,archivedAt]
         # Finding.assetId → Asset?(setNull) — purely additive; the existing
         # free-text affectedAsset/affectedAssetType on Finding still works
         # standalone, so this does not break Sprint 3 data.

Report   id, organizationId→Org(cascade), assessmentId→Assessment(cascade),
         title, findingCount (snapshot count), format="PDF",
         generatedById→User?(setNull), createdAt
         @@index [org,assessment] [org,createdAt]
```
- **Asset inventory**: a formal, reusable record per organization (Domain/URL/IP/Server/
  Active Directory/Azure/AWS/API/MobileApp/Other). Findings can optionally link to one
  via `assetId`, shown as a dropdown alongside the existing free-text field.
- **PDF export is generated live, on demand** — not stored as a blob (no object storage
  yet). `GET /dashboard/assessments/[id]/report` (a Route Handler, not a server action,
  since server actions cannot stream binary responses) re-loads the assessment + its
  non-archived findings straight from the DB, renders a branded PDF with
  `@react-pdf/renderer` (self-consistent brand: shield mark, cover page, executive
  summary, severity-count summary, findings table, detailed findings), and streams it
  as `application/pdf` with `Content-Disposition: attachment`. Every generation writes
  a `Report` audit row (title + finding count snapshot + who/when) and an ActivityLog
  entry — the row is metadata only; the PDF itself is always regenerated fresh from
  current data, so it can never go stale relative to what's stored.
- RBAC: report generation requires MEMBER+ (same as viewing/editing); Asset CRUD follows
  the same MEMBER+ create/edit/archive, ADMIN+ delete pattern as Assessments/Findings.

Full diagram: see `docs/ERD.md`.

### Sprint 5 — Vulnerability Management Workflow
```
Finding (extended)  + status workflow (Open|InProgress|ReadyForValidation|Resolved|
                      AcceptedRisk|FalsePositive; legacy Fixed/Verified still accepted
                      and treated as closed — no data migration needed)
                    + assigneeId→User?(setNull), assignedById, assignedAt
                    + dueDate, slaOverridden (SLA auto-calc from severity)
                    + acceptedRiskReason, acceptedRiskById→User?(setNull),
                      acceptedRiskAt, acceptedRiskUntil
                    + resolvedAt, validatedAt
                    @@index [org,assigneeId] [org,dueDate]

FindingComment      id, organizationId→Org(cascade), findingId→Finding(cascade),
                    body (Markdown), authorId→User?(setNull), editedAt?, deletedAt?
                    @@index [findingId,createdAt] [org]

Evidence            + deletedAt (soft delete)
```
**Design decisions (to preserve Sprint 4 compatibility):**
- The spec's `FindingActivity` (timeline) and `FindingEvidence` are served by the
  **existing** `ActivityLog` and `Evidence` models rather than new duplicates —
  ActivityLog already records per-finding user/action/detail/timestamp (timeline +
  status history), and Evidence gained a `deletedAt` for soft delete. Only
  `FindingComment` is genuinely new.
- **Status history** is preserved as immutable `ActivityLog` entries
  (`finding.status_changed`, `finding.severity_changed`, `finding.assigned`,
  `finding.risk_accepted`, `comment.added`, `evidence.*`) — chronological, per finding.
- **SLA**: `computeDueDate(severity)` (Critical 7d / High 30d / Medium 60d / Low 90d /
  Informational none) auto-sets `dueDate` at creation and recomputes on severity change
  unless `slaOverridden`. Overdue = due in the past AND status not closed.
- **Status is managed only via the workflow action** (`changeStatusAction`), not the edit
  form — so history + lifecycle timestamps (`resolvedAt`/`validatedAt`) stay correct.
  Allowed transitions are enforced by `STATUS_TRANSITIONS`.
- **Roles**: added `CLIENT` (rank 0, read-only) below `MEMBER` (= "Security Analyst").
  All mutations gate at MEMBER+, so CLIENT is read-only everywhere with no per-page work.
- **REST API** (`/api/v1/*`): session-cookie-auth'd, org-scoped JSON. Implemented:
  `GET /findings`, `GET /findings/:id` (with timeline + comments), `POST /findings/:id/status`,
  `GET|POST /findings/:id/comments`, `GET /metrics`. Assignment / due-date / risk-acceptance /
  evidence follow the same pattern (currently driven through server actions in the UI).

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
- **Sprint 4 (done):** Assets (formal inventory, optionally linked to findings), Reports (audit log), live PDF export via `@react-pdf/renderer`.
- **Sprint 5 (done):** Vulnerability management workflow — status lifecycle + history, assignment, SLA/overdue, risk acceptance, comments (Markdown/soft-delete), timeline, dashboard analytics (MTTR/distributions), CLIENT read-only role, REST API.
- Later: notifications, audit logs, billing, API keys, developer docs.

## RBAC on assessments
- View / list: any member.
- Create / edit / archive: MEMBER+ (consultants do the work).
- Hard delete: ADMIN+ only (destructive).
All actions re-load the session server-side and verify `organizationId` scope before mutating.
