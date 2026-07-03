# JectarOne Client Portal

A multi-tenant client portal for JectarOne: clients log in to view their security
assessments, findings, and reports. Separate from the marketing site (`jectar.one`);
deploys to app-capable hosting (e.g. Vercel) at `app.jectar.one`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the frozen design.

## Stack
Next.js 15 (App Router) · TypeScript · Prisma (SQLite dev → Postgres prod) ·
self-rolled JWT session auth (jose + bcryptjs) · zod validation · plain CSS (brand tokens).

## Sprint 1 (implemented)
- **Authentication** — sign up, sign in, sign out; bcrypt hashing; signed httpOnly JWT session.
- **Organizations** — created on sign-up; the signer becomes OWNER.
- **Multi-tenancy** — all data scoped by `organizationId`; the session carries the active org.
- **User management** — add members (with role), change roles (owner), remove members; RBAC enforced server-side (`OWNER > ADMIN > MEMBER`).
- **Dashboard shell** — sidebar nav, overview, team page.

## Sprint 2 (implemented) — Assessment Management
- Persisted, DB-backed assessments (replaces the client-side Report Builder workflow).
- **Create / edit / archive / delete** assessments per organization.
- Fields: client name, type (Web, Network, Cloud, Active Directory, ISO 27001, NIST CSF, Other), scope, status (Draft, In Progress, Review, Delivered), start/end dates, lead consultant, executive summary, notes.
- Org-scoped (`organizationId`) with RBAC: MEMBER+ create/edit/archive; ADMIN+ hard delete.
- List with status filters + archived view; dashboard metrics for active/delivered.
- Schema designed so Findings, Evidence, Assets, and Reports attach via `assessmentId` in later sprints.

## Sprint 3 (implemented) — Findings & Evidence
- **Findings** per assessment: title, description, technical details, business impact, remediation, verification steps.
- **Severity** (Critical/High/Medium/Low/Informational) + **status** (Open/In Progress/Fixed/Verified/Accepted Risk/False Positive) with colored badges.
- **Risk matrix** — Risk = Likelihood × Impact on a 5×5 grid; rendered per finding.
- **CVSS** base score (0–10) + vector; **OWASP / CWE / MITRE ATT&CK** mapping; **affected asset** + type.
- **Evidence** — register file metadata (filename, MIME, size, uploader, note) per finding; storage-key reserved for future cloud upload (no schema change needed).
- **Activity log** — audit trail (created/edited/archived/restored/deleted, evidence add/remove) with user + timestamp; survives deletion via SetNull.
- **Search / filter / sort** — by title/asset/CWE/OWASP, severity, status; sort newest/oldest/severity/CVSS. Per-assessment and global (`/dashboard/findings`) views.
- **Dashboard** — Open / Critical / High / Resolved findings + Average Risk.
- RBAC: MEMBER+ create/edit/archive; **ADMIN+ delete**. All org-scoped; cross-tenant access impossible.
- ERD: see `docs/ERD.md`.

## Local development
```bash
cp .env.example .env          # then edit AUTH_SECRET
npm install
npm run db:push               # creates the SQLite dev.db from the schema
npm run dev                   # http://localhost:3000
```
Sign up at `/signup` to create your first organization.

## Tests
```bash
npm test    # node:test — RBAC hierarchy + slug generation
```

## Deploy to production (Vercel + Neon Postgres)
1. Create a Postgres database (Neon free tier works).
2. In `prisma/schema.prisma`, set `datasource db { provider = "postgresql" }`.
3. Set env vars on the host: `DATABASE_URL` (the Postgres URL) and a strong `AUTH_SECRET`.
4. Run migrations: `npx prisma migrate deploy` (or `prisma db push` for the first cut).
5. Deploy. Point `app.jectar.one` at it.

> `.env`, `prisma/dev.db`, and `node_modules` are gitignored. Never commit secrets.

## Security notes
- Passwords hashed with bcrypt (cost 12).
- Session = signed JWT (HS256) in an httpOnly, `sameSite=lax`, secure-in-prod cookie.
- Middleware gates `/dashboard/*` at the edge (signature check); authorization is re-checked in server code against the DB.
- Every server action validates input with zod and enforces RBAC before mutating.
