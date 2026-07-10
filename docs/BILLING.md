# Billing — architecture & operations

Sprint 19 adds commercial infrastructure: subscriptions, Stripe billing, plan
enforcement, usage metering, and AI credits. This doc covers how it's wired
and how to operate it.

## Model

- **Plans are code, not a DB table** (`src/lib/plans.ts`) — `starter | professional | business | enterprise`,
  same pattern as roles/severities elsewhere in this codebase. Each plan defines
  `PlanLimits` (max users/engagements/findings/storage/AI requests) and `PlanFeatures`
  (retest, api, branding, crm, integrations, whiteLabel, sso).
- **`Subscription`** (one per organization) mirrors Stripe state: `plan`, `status`
  (`trialing|active|past_due|canceled|expired`), `billingCycle`, Stripe IDs, period
  dates. **Never trust a plan/status value that didn't come from a verified source**
  — see "Source of truth" below.
- **`UsageCounter`** — one row per org per calendar month (`"YYYY-MM"`), incremented
  on each AI request. No cron reset needed; a new period key just starts a fresh row.
- **`AiUsageLog`** — per-request detail trail (provider/model/capability). Token
  counts are only populated when the provider reports them (the AI layer doesn't
  fabricate figures it doesn't have).
- **`Invoice`** — local mirror of Stripe invoices, populated by the `invoice.payment_succeeded`
  webhook, for fast billing-page rendering without a live Stripe API call.

## Billing modes

Billing runs in one of three modes, resolved by `src/lib/stripe.ts`:

| Mode | Condition | Behavior |
|---|---|---|
| `stripe` | `STRIPE_SECRET_KEY` set | Real Checkout/Portal/webhooks |
| `mock` | `BILLING_MODE=mock`, no Stripe keys | Offline mock checkout (dev/CI) |
| `disabled` | neither (default) | Billing hidden, gates open, no trials |

**Disabled mode** (a bare deployment with no billing env) degrades gracefully:
the Billing settings tab is hidden and the page shows a "Billing coming soon"
notice; checkout/cancel/resume actions no-op; signup creates no trial and sends
no trial email; the trial banner never renders; plan limits and feature gates
are **not enforced** (features are free until billing ships — commercial gating
with no way to pay would dead-end users); the cron sweep returns zeros. No code
path throws. If billing is enabled later, orgs get a trial subscription lazily
via `getOrCreateSubscription` on their next dashboard load.

## Source of truth — production vs. dev/CI

**Production (Stripe configured):** the **only** code path that writes `Subscription`/`Invoice`
state is `src/app/api/webhooks/stripe/route.ts`, after Stripe signature verification
(`STRIPE_WEBHOOK_SECRET`). Checkout/portal/cancel actions in `src/actions/billing.ts`
only *initiate* requests to Stripe (redirect to Checkout/Portal, or call the
Subscriptions API for cancel/resume) — they never assign a plan themselves.

**Dev/CI (`BILLING_MODE=mock`):** there's no real Stripe to send webhooks, so
`confirmMockCheckoutAction` calls the *same* shared state-transition functions in
`src/lib/billing-sync.ts` that the webhook calls — directly, server-side, gated by
session + ADMIN role. The mock-checkout page (`/dashboard/settings/billing/mock-checkout`)
redirects to `/dashboard/settings/billing` unless explicit mock mode is active, so
this path is unreachable both in a Stripe-configured deployment and in disabled
mode. This mirrors the AI-provider mock pattern (`src/lib/ai/provider.ts`) used
elsewhere in the app. The Playwright suite sets `BILLING_MODE=mock` in its
webServer env (`playwright.config.ts`).

## Feature gating

`src/lib/billing.ts` exports the plan-side counterpart to `hasRole`/`requireRole`:

- `effectivePlan(sub)` — the tier actually enforced *right now*. `canceled`/`expired`
  always fall back to Starter-level access regardless of the stored `plan` (kept for
  billing history/display); `trialing`/`active`/`past_due` keep the purchased tier
  (`past_due` is a grace period, not a hard lock).
- `requirePlan(sub, min)` / `hasFeature(sub, "retest")` — call these in every gated
  server action, the same way `hasRole(session.role, "ADMIN")` is called. **Limits
  are enforced server-side only** — see
  `src/actions/{retest,team,engagements,findings,evidence,ai,api-tokens}.ts`
  for the wired examples (retest requires Professional+, team invites respect
  `maxUsers`, engagement creation respects `maxEngagements`, finding creation
  respects `maxFindings`, evidence uploads respect `storageBytes`, AI requests
  respect the monthly counter).
- **API tokens are gated per request**, not just at creation: `apiSession()`
  (`src/lib/api.ts`) re-checks `hasFeature(sub, "api")` for every token-authenticated
  call, so a token minted during a trial stops working after a downgrade,
  cancellation, or trial expiry (403 with an upgrade hint).
- **AI credits are reserved atomically** (`reserveAiRequest` in `src/lib/billing.ts`):
  the limit check and the increment are one conditional UPDATE, so concurrent
  requests cannot overshoot the monthly allowance. The credit is spent once the
  request reaches the provider (refusals included) and refunded if the provider
  call throws. Integration coverage: `npm run test:billing` (real Postgres).
- `getOrCreateSubscription(orgId)` lazily provisions a 14-day Professional-tier
  trial for any org that doesn't have a subscription row yet (defensive — new
  signups get one eagerly in `signupAction`, so this only fires for edge cases).

## Trials

New signups start a 14-day trial at **Professional** tier (full-featured, so the
funnel shows real value before asking for a card). `sweepTrialExpiry(orgId)` is
called on every dashboard page load (lazy sweep, same pattern as the risk-acceptance
auto-reopen) — if `trialEndsAt` has passed, status flips to `expired` and access
drops to Starter via `effectivePlan`.

## Cron sweep

`POST /api/cron/billing` (protected by the `CRON_SECRET` header) runs
`sweepAllBillingNotifications()`:
1. Bulk-expires any trials whose `trialEndsAt` has passed (belt-and-suspenders —
   the lazy per-request sweep already handles this for active users; this catches
   orgs nobody has logged into).
2. Sends the one-time "trial ending soon" email for trials closing within 3 days
   (idempotent via `trialEndingNotifiedAt`).

Triggered daily by `.github/workflows/billing-cron.yml`. Requires the `CRON_SECRET`
repo secret to match the app's `CRON_SECRET` env var.

## Emails

Reuses the existing SMTP infrastructure (`src/lib/email.ts`) — no new provider.
Templates: trial started, trial ending, payment succeeded, payment failed,
subscription cancelled, plan upgraded. Sent to all OWNER/ADMIN members of the org
(best-effort — a failed send never blocks the underlying state change).

## Revenue dashboard

`/dashboard/admin/revenue` is **not** organization-scoped — it's internal tooling
for the JectarOne team. There is no cross-tenant "platform admin" role in this
app's RBAC by design, so access is gated by an email allowlist
(`PLATFORM_ADMIN_EMAILS`, `src/lib/platform-admin.ts`) rather than a new role.
MRR/ARR/ARPC are computed directly from current `Subscription` rows. **Churn and
LTV are labeled approximations** — there's no dedicated billing-events ledger yet,
so churn is estimated from `Subscription.updatedAt` on canceled rows in the last
30 days. Revisit if/when a proper events log is added.

## Setting up Stripe (production)

1. Create a Stripe account, four Products (Starter/Professional/Business, each
   with a monthly and annual Price — Enterprise stays sales-assisted, no self-serve price).
2. Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and the six
   `STRIPE_PRICE_*` env vars.
3. Register the webhook endpoint (`https://portal.jectar.one/api/webhooks/stripe`)
   in the Stripe Dashboard for: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Local testing with real Stripe (optional — mock mode works without this):
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## Testing

- **Unit** (`test/unit.test.mjs`): plan hierarchy, `underLimit`, `effectivePlan`
  (canceled/expired fallback), Stripe status mapping, trial-expiry date logic,
  annual-pricing discount math.
- **E2E** (`test/e2e/billing.spec.ts`): billing-page rendering for a paying
  customer, trial banner, full mock-checkout upgrade flow, cancel/resume,
  non-admin access denial, and plan-limit enforcement (Starter org seeded at its
  user and engagement caps).
- **CI** runs entirely in mock mode (`STRIPE_SECRET_KEY` unset) — no Stripe
  account or network access required.
