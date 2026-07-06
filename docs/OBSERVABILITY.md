# Observability — health, logging, monitoring, uptime

## Health endpoint
`GET /api/health` (no auth, no sensitive data):
```json
{ "status": "ok", "time": "…", "uptimeSeconds": 123,
  "version": "<git sha>", "checks": { "database": "ok", "storage": "configured" } }
```
- `200` when the DB is reachable, `503` when not (`Cache-Control: no-store`).
- Used by the production deploy smoke check, the uptime workflow, and external monitors.

## Structured logging
`src/lib/logger.ts` emits one JSON line per event (`level`, `time`, `message`, +
fields, `error`/`stack`). Vercel Runtime Logs and any log drain can index these.
`logger.error(...)` also forwards to Sentry when `SENTRY_DSN` is set.

Guidelines: log at boundaries (failed external calls, auth/security events,
background jobs). Never log secrets, tokens, passwords, or full PII.

## Error monitoring (Sentry)
Wired in Sprint 10 (`@sentry/nextjs`), inert unless `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN` are set. Server, edge, and client are instrumented; the
`global-error` boundary reports unhandled client errors.

**Dashboards to set up in Sentry:**
- Issues (unresolved, by release) with alerts to email/Slack.
- Performance: p95 latency for `/api/v1/*`, report generation, and auth actions.
- Release health: crash-free sessions per deploy (tag releases with the git SHA).
- Alert rules: new issue, error-rate spike, and any `SMTP send failed` /
  `report render` errors.

## Uptime monitoring
Primary: a dedicated monitor (Better Stack / UptimeRobot / Pingdom) hitting
`https://portal.jectar.one/api/health` every 1–3 min, alerting on non-200 or
`status != "ok"`. Backstop: `.github/workflows/uptime.yml` (15-min cron).

## Key operational signals
| Signal | Where | Alert when |
|---|---|---|
| App down | `/api/health` monitor | non-200 for 2 consecutive checks |
| DB unreachable | health `checks.database` | `down` |
| Error spike | Sentry | error rate > baseline |
| Email failures | logs `SMTP send failed` | any in 15 min |
| Backup broken | `backup-verify` workflow | job fails |
| Deploy unhealthy | `deploy-production` smoke step | fails → rollback |
