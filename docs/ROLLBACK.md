# Rollback runbook

Goal: restore a healthy production state fast. Decide **code rollback** vs
**data rollback** — they are different.

## 1. Confirm the problem
- `curl -s https://portal.jectar.one/api/health` → is `status` ok / DB up?
- Check Sentry (new issues / error spike) and Vercel Runtime Logs.
- Note the current + previous deployment SHAs (Vercel → Deployments).

## 2. Roll back the code (fast, ~1 min)
Vercel keeps immutable deployments — promote the last good one:
- **Dashboard:** Deployments → the previous healthy production deployment →
  **Promote to Production** (instant alias switch, no rebuild).
- **CLI:** `vercel rollback <previous-deployment-url> --token=$VERCEL_TOKEN`
- **Git:** revert the offending commit on `main`; CI + deploy re-run. Slower —
  prefer promote for an outage.

Verify: `/api/health` = 200 and the error spike stops.

## 3. Handle the database (only if a migration is involved)
Prisma migrations are **forward-only** — do NOT auto-"un-migrate".
- **Additive migration** (new table/column/index): usually safe to leave; the
  promoted older code simply ignores it. Prefer this — no data action needed.
- **Destructive migration** (dropped/renamed/altered column with data loss): the
  old code may break. Restore from backup:
  1. Put the app in maintenance / accept downtime.
  2. Restore the latest verified dump into the prod DB (see `scripts/verify-backup.sh`
     for the dump/restore commands; the backup-verify workflow proves these work).
  3. Re-point the app; validate `/api/health` + spot-check data.
- **Design guidance:** ship destructive changes as **expand → migrate → contract**
  across releases so a code rollback never needs a data rollback.

## 4. Secrets / tokens
If a secret leaked (secret-scan / gitleaks alert): rotate it immediately
(`AUTH_SECRET`, SMTP, S3/R2 keys, `VERCEL_TOKEN`), redeploy. Rotating `AUTH_SECRET`
invalidates all sessions (users re-login) — acceptable during an incident.

## 5. After
- Write a short incident note (what, when, root cause, fix).
- Add a regression test for the failure.
- If a migration caused it, revisit the expand/contract plan.
