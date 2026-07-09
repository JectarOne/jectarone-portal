import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/db";
import { planPriceCents, planLabel, isPlan } from "@/lib/plans";

function cents(n: number): string { return `$${(n / 100).toFixed(0)}`; }

/**
 * Internal revenue dashboard for the JectarOne team — not org-scoped.
 * Gated by PLATFORM_ADMIN_EMAILS (see src/lib/platform-admin.ts). Churn and
 * LTV below are approximations from current subscription state (there is no
 * dedicated billing-events ledger yet) — labeled as such, not audited figures.
 */
export default async function RevenueDashboardPage() {
  const session = await getSession();
  if (!session) return null;
  if (!isPlatformAdmin(session.user.email)) redirect("/dashboard");

  const subs = await prisma.subscription.findMany({ include: { organization: { select: { name: true } } } });

  const active = subs.filter((s) => s.status === "active");
  const trialing = subs.filter((s) => s.status === "trialing");
  const pastDue = subs.filter((s) => s.status === "past_due");
  const canceled = subs.filter((s) => s.status === "canceled");
  const expired = subs.filter((s) => s.status === "expired");

  const monthlyRevenueCents = active.reduce((sum, s) => {
    if (!isPlan(s.plan) || s.plan === "enterprise") return sum;
    const price = planPriceCents(s.plan, s.billingCycle === "annual" ? "annual" : "monthly");
    return sum + (s.billingCycle === "annual" ? Math.round(price / 12) : price);
  }, 0);
  const mrr = monthlyRevenueCents;
  const arr = mrr * 12;
  const arpc = active.length > 0 ? Math.round(mrr / active.length) : 0;

  // Approximate monthly churn: cancellations in the last 30 days / (active + those cancellations).
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const recentCancellations = canceled.filter((s) => s.updatedAt >= thirtyDaysAgo).length;
  const churnBase = active.length + recentCancellations;
  const churnRate = churnBase > 0 ? recentCancellations / churnBase : 0;
  const ltvCents = churnRate > 0 ? Math.round(arpc / churnRate) : null;

  const byPlan = (["starter", "professional", "business", "enterprise"] as const).map((p) => ({
    plan: p, count: subs.filter((s) => s.plan === p && (s.status === "active" || s.status === "trialing")).length,
  }));

  return (
    <>
      <div className="topbar"><div><h1>Revenue</h1><p>Internal — platform-wide, not organization-scoped.</p></div></div>

      <div className="grid grid-5">
        <div className="card metric"><span>MRR</span><strong>{cents(mrr)}</strong></div>
        <div className="card metric"><span>ARR</span><strong>{cents(arr)}</strong></div>
        <div className="card metric"><span>Active customers</span><strong>{active.length}</strong></div>
        <div className="card metric"><span>Trials</span><strong>{trialing.length}</strong></div>
        <div className="card metric"><span>Cancelled</span><strong>{canceled.length}</strong></div>
      </div>

      <div className="grid grid-5" style={{ marginTop: "1rem" }}>
        <div className="card metric"><span>Past due</span><strong className="sev-critical-text">{pastDue.length}</strong></div>
        <div className="card metric"><span>Trial expired</span><strong>{expired.length}</strong></div>
        <div className="card metric"><span>ARPC</span><strong>{cents(arpc)}</strong></div>
        <div className="card metric"><span>Monthly churn (approx.)</span><strong>{(churnRate * 100).toFixed(1)}%</strong></div>
        <div className="card metric"><span>LTV (approx.)</span><strong>{ltvCents !== null ? cents(ltvCents) : "—"}</strong></div>
      </div>

      <div className="section-head"><h2>Customers by plan</h2></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Plan</th><th>Active + trialing</th></tr></thead>
          <tbody>
            {byPlan.map((r) => <tr key={r.plan}><td>{planLabel(r.plan)}</td><td>{r.count}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="section-head"><h2>All organizations</h2></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Cycle</th><th>Renews</th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td>{s.organization.name}</td>
                <td>{planLabel(s.plan)}</td>
                <td>{s.status}</td>
                <td>{s.billingCycle}</td>
                <td className="muted">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString().slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
