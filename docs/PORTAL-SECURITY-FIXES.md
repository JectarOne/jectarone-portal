# Portal security — remaining gaps & verification

Companion to the `security-hardening` branch. What was fixed, how to verify, and
what still needs a product/infra decision.

## Fixed on this branch

| Item | Sev | Where |
|------|-----|-------|
| Security headers + drop `X-Powered-By` | High | `next.config.mjs` |
| Login brute-force throttle | High | `src/lib/rate-limit.ts`, `loginAction` |
| Signup enumeration (per-IP throttle) | Medium | `signupAction` |

### Deploy step (required for the throttle)
The throttle adds a `LoginAttempt` model, shipped as migration
`prisma/migrations/0002_add_login_attempt`. The Vercel build already runs
`prisma migrate deploy`, so it applies automatically **once the DB is baselined**.

If the production DB predates Prisma Migrate (created via `db push`),
`migrate deploy` fails with **P3005**. Baseline it once — see the "One-time
baseline" section in `README.md`:
```bash
# with DATABASE_URL → production, run ONCE:
npx prisma migrate resolve --applied 0001_init
```
Then `migrate deploy` applies `0002` and all future migrations. **Never use
`prisma db push` in production.**

### Verify headers live
```bash
curl -sSI https://portal.jectar.one/login | grep -iE 'content-security|frame-options|nosniff|referrer|strict-transport|powered'
# expect CSP + X-Frame-Options: DENY + nosniff + HSTS, and NO X-Powered-By
```

### Verify throttle
Attempt 6 logins for one email within 15 min → the 6th returns
"Too many attempts…" without revealing whether the account exists.

## Still open — need a decision or infra

### Email verification & password reset (no mailer yet)
- Signup currently creates the account and logs in immediately. Full
  non-enumerable signup + self-service reset need transactional email.
- **Plan:** add a `VerificationToken` model (single-use, hashed, short TTL),
  send via the same SMTP mailbox the marketing site uses (or a provider), gate
  dashboard access on `emailVerifiedAt`. Password reset: request → emailed
  single-use token → set new hash → invalidate sessions.

### M2 — CORS `Access-Control-Allow-Origin: *`
- Observed on the **static login HTML** (Vercel CDN default for static assets),
  not emitted by any API route — API routes are same-origin and set no ACAO.
- **Action:** confirm no `/api/*` route ever returns `ACAO: *` with credentials;
  if the static-asset `*` is undesirable, pin it via Vercel project config.

### Not yet automated
- The login throttle and S3 upload paths could not be runtime-tested here (no
  live Postgres / bucket credentials). Logic is unit-tested; run an integration
  check against a staging DB + bucket before release.
