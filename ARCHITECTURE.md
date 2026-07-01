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

## Data model (Sprint 1)
```
User         id, email(unique), name, passwordHash, createdAt
Organization id, name, slug(unique), createdAt
Membership   id, userId → User, organizationId → Organization,
             role ("OWNER" | "ADMIN" | "MEMBER"), createdAt
             @@unique([userId, organizationId])
```
Future sprints add: Assessment, Finding, Report (tenant-scoped by organizationId), AuditLog.

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
- **Sprint 1 (this):** Auth, Organizations, Multi-tenancy, User Management. ← building now
- Sprint 2: RBAC polish, dashboard shell, navigation, layout.
- Sprint 3: Assessments & findings (persist the existing Report Builder).
- Sprint 4: Reports, risk matrix, exports.
- Later: notifications, audit logs, billing, API keys, developer docs.
