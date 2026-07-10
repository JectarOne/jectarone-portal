import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PLANS, PLAN_LIMITS, planLabel, planPriceCents, limitLabel, type Plan } from "@/lib/plans";
import { getOrCreateSubscription, sweepTrialExpiry, effectivePlan, orgUsageSnapshot, getOrCreateUsageCounter } from "@/lib/billing";
import { stripeConfigured, billingEnabled } from "@/lib/stripe";
import { cancelSubscriptionAction, resumeSubscriptionAction, openPortalAction } from "@/actions/billing";
import { PlanCheckoutButton } from "./PlanCheckoutButton";

function dateStr(d: Date | null): string { return d ? new Date(d).toISOString().slice(0, 10) : "—"; }
function money(cents: number): string { return cents === 0 ? "Custom" : `$${(cents / 100).toFixed(0)}`; }
function bytes(n: number | null): string {
  if (n === null) return "Unlimited";
  const gb = n / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)} GB` : `${(n / (1024 * 1024)).toFixed(0)} MB`;
}

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trial", active: "Active", past_due: "Payment overdue", canceled: "Cancelled", expired: "Trial expired",
};
const STATUS_CLASS: Record<string, string> = {
  trialing: "rstate-inreview", active: "rstate-published", past_due: "rt-failed", canceled: "fstatus-archived", expired: "rt-failed",
};

export default async function BillingPage() {
  const session = await getSession();
  if (!session) return null;

  // Billing-disabled mode (no Stripe keys, no mock flag): a friendly notice
  // instead of the plan picker — never an error, never a checkout entry point.
  if (!billingEnabled()) {
    return (
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 className="sub">Billing</h3>
        <p><strong>Billing coming soon.</strong></p>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Subscriptions are not available on this deployment yet — all features are currently included.
        </p>
      </div>
    );
  }

  await sweepTrialExpiry(session.orgId);
  const sub = await getOrCreateSubscription(session.orgId);
  const plan = effectivePlan(sub);
  const limits = PLAN_LIMITS[plan];
  const canManage = hasRole(session.role, "ADMIN");

  const [usage, counter, invoices] = await Promise.all([
    orgUsageSnapshot(session.orgId),
    getOrCreateUsageCounter(session.orgId),
    prisma.invoice.findMany({ where: { organizationId: session.orgId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return (
    <div style={{ marginTop: "1rem" }}>
      {sub.status === "trialing" && sub.trialEndsAt && (
        <div className="alert alert-ok" style={{ marginBottom: "1rem" }}>
          Free trial — full {planLabel("professional")} access until <strong>{dateStr(sub.trialEndsAt)}</strong>.
        </div>
      )}
      {sub.status === "expired" && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          Your trial has ended. Choose a plan below to keep full access — you&apos;re currently limited to the Starter tier.
        </div>
      )}
      {sub.status === "past_due" && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          Your last payment failed. Update your payment method to avoid losing access.
        </div>
      )}

      {/* Current plan */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 className="sub">Current plan</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>{planLabel(sub.plan)}</span>
          <span className={`badge ${STATUS_CLASS[sub.status] ?? ""}`}>{STATUS_LABELS[sub.status] ?? sub.status}</span>
          {sub.cancelAtPeriodEnd && <span className="badge rt-failed">Cancels {dateStr(sub.currentPeriodEnd)}</span>}
        </div>
        <dl className="kv">
          <dt>Billing cycle</dt><dd>{sub.billingCycle === "annual" ? "Annual" : "Monthly"}</dd>
          <dt>Renews</dt><dd>{dateStr(sub.currentPeriodEnd)}</dd>
        </dl>
        {canManage && (
          <div className="form-actions" style={{ marginTop: "0.8rem" }}>
            {stripeConfigured() ? (
              <form action={openPortalAction}><button className="btn btn-secondary" type="submit">Manage billing</button></form>
            ) : (
              <>
                {!sub.cancelAtPeriodEnd && sub.status !== "trialing" && sub.status !== "expired" && (
                  <form action={cancelSubscriptionAction}><button className="btn btn-danger" type="submit">Cancel subscription</button></form>
                )}
                {sub.cancelAtPeriodEnd && (
                  <form action={resumeSubscriptionAction}><button className="btn btn-secondary" type="submit">Resume subscription</button></form>
                )}
              </>
            )}
          </div>
        )}
        {!stripeConfigured() && <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.6rem" }}>Stripe is not configured — running in test mode (no real payments).</p>}
      </div>

      {/* Usage */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 className="sub">Usage this period</h3>
        <div className="grid grid-5">
          <div className="metric"><span>Users</span><strong>{usage.users} / {limitLabel(limits.maxUsers)}</strong></div>
          <div className="metric"><span>Engagements</span><strong>{usage.engagements} / {limitLabel(limits.maxEngagements)}</strong></div>
          <div className="metric"><span>Findings</span><strong>{usage.findings} / {limitLabel(limits.maxFindings)}</strong></div>
          <div className="metric"><span>Storage</span><strong>{bytes(usage.storageBytes)} / {bytes(limits.storageBytes)}</strong></div>
          <div className="metric"><span>AI requests</span><strong>{counter.aiRequests} / {limitLabel(limits.aiRequestsPerMonth)}</strong></div>
        </div>
      </div>

      {/* Plan picker */}
      <h3 className="sub" style={{ marginTop: "1.4rem" }}>Plans</h3>
      <div className="grid grid-3" style={{ marginBottom: "1rem" }}>
        {PLANS.filter((p) => p !== "enterprise").map((p) => (
          <PlanCard key={p} plan={p} current={sub.plan === p} canManage={canManage} />
        ))}
        <div className="card">
          <h4 style={{ marginBottom: "0.3rem" }}>{planLabel("enterprise")}</h4>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.8rem" }}>Custom limits, SSO, SCIM, white label, dedicated support.</p>
          <Link className="btn btn-secondary btn-block" href="mailto:contact@jectar.one?subject=Enterprise%20plan">Contact us</Link>
        </div>
      </div>

      {/* Invoices */}
      <h3 className="sub" style={{ marginTop: "1.4rem" }}>Invoice history</h3>
      <div className="card">
        {invoices.length === 0 ? (
          <p className="muted">No invoices yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Number</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number ?? inv.stripeInvoiceId}</td>
                  <td>${(inv.amountPaidCents / 100).toFixed(2)} {inv.currency.toUpperCase()}</td>
                  <td><span className={`badge ${inv.status === "paid" ? "rstate-published" : "rt-failed"}`}>{inv.status}</span></td>
                  <td className="muted">{dateStr(inv.createdAt)}</td>
                  <td>{inv.invoicePdf && <Link href={inv.invoicePdf} target="_blank">PDF</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, current, canManage }: { plan: Plan; current: boolean; canManage: boolean }) {
  const limits = PLAN_LIMITS[plan];
  return (
    <div className="card" style={current ? { borderColor: "var(--line-strong)" } : undefined}>
      <h4 style={{ marginBottom: "0.15rem" }}>{planLabel(plan)}</h4>
      <p style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.6rem" }}>
        {money(planPriceCents(plan, "monthly"))}<span className="muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>/mo</span>
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.8rem", fontSize: "0.85rem", display: "grid", gap: "0.3rem" }}>
        <li>{limitLabel(limits.maxUsers)} users</li>
        <li>{limitLabel(limits.maxEngagements)} engagements</li>
        <li>{limitLabel(limits.aiRequestsPerMonth)} AI requests/mo</li>
        <li className={limits.features.retest ? "" : "muted"}>{limits.features.retest ? "✓" : "✗"} Retest workflow</li>
        <li className={limits.features.api ? "" : "muted"}>{limits.features.api ? "✓" : "✗"} API access</li>
        <li className={limits.features.crm ? "" : "muted"}>{limits.features.crm ? "✓" : "✗"} CRM</li>
      </ul>
      {current ? (
        <button className="btn btn-secondary btn-block" disabled>Current plan</button>
      ) : canManage ? (
        <PlanCheckoutButton plan={plan} cycle="monthly" label="Choose plan" variant={plan === "professional" ? "primary" : "secondary"} />
      ) : (
        <button className="btn btn-secondary btn-block" disabled>Admin only</button>
      )}
    </div>
  );
}
