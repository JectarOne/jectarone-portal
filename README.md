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
