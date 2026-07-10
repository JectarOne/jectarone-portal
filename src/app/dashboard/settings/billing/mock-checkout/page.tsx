import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { isPlan, planLabel, planPriceCents } from "@/lib/plans";
import { billingMockMode } from "@/lib/stripe";
import { MockCheckoutForm } from "./MockCheckoutForm";

/**
 * Dev/CI stand-in for the real Stripe Checkout page — only reachable in
 * explicit mock billing mode (BILLING_MODE=mock, no Stripe keys). Lets the
 * full upgrade flow be exercised offline (local dev, CI) without a Stripe
 * account, mirroring the AI mock-provider pattern used elsewhere. Not
 * reachable with real Stripe, nor when billing is disabled.
 */
export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; cycle?: string }> }) {
  if (!billingMockMode()) redirect("/dashboard/settings/billing");
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "ADMIN")) redirect("/dashboard/settings/billing");

  const { plan, cycle: cycleRaw } = await searchParams;
  if (!plan || !isPlan(plan) || plan === "enterprise") redirect("/dashboard/settings/billing");
  const cycle = cycleRaw === "annual" ? "annual" : "monthly";
  const priceCents = planPriceCents(plan, cycle);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="badge rt-scheduled" style={{ marginBottom: "0.8rem" }}>TEST MODE — no real charge</span>
        <h1>Subscribe to {planLabel(plan)}</h1>
        <p className="sub">{session.organization.name} · {cycle === "annual" ? "Billed annually" : "Billed monthly"}</p>
        <p style={{ fontSize: "1.8rem", fontWeight: 700, margin: "1rem 0" }}>
          ${(priceCents / 100).toFixed(2)} <span className="muted" style={{ fontSize: "0.9rem", fontWeight: 500 }}>{cycle === "annual" ? "/year" : "/month"}</span>
        </p>
        <MockCheckoutForm plan={plan} cycle={cycle} label={`Pay ${money(priceCents)} (test)`} />
        <p className="foot"><Link href="/dashboard/settings/billing">Cancel and go back</Link></p>
      </div>
    </div>
  );
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
