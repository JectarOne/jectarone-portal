"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { isPlan, type Plan } from "@/lib/plans";
import { stripeConfigured, getStripe, priceIdFor } from "@/lib/stripe";
import { getOrCreateSubscription } from "@/lib/billing";
import { applyCheckoutCompleted } from "@/lib/billing-sync";
import { appUrl } from "@/lib/email";

export type BillingState = { error?: string };

const BILLING_PATH = "/dashboard/settings/billing";

function isCycle(v: unknown): v is "monthly" | "annual" {
  return v === "monthly" || v === "annual";
}

/**
 * Start a checkout for a plan. Real Stripe: creates a Checkout Session and
 * redirects to Stripe. Mock mode (STRIPE_SECRET_KEY unset — dev/CI only):
 * redirects to an internal mock-checkout page that never writes plan/status
 * itself — the confirm action does that, mirroring what the real webhook does.
 */
export async function startCheckoutAction(_prev: BillingState, fd: FormData): Promise<BillingState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "ADMIN")) return { error: "Only admins can manage billing." };

  const plan = String(fd.get("plan") ?? "");
  const cycle = String(fd.get("cycle") ?? "monthly");
  if (!isPlan(plan) || plan === "enterprise") return { error: "Select a valid plan." };
  if (!isCycle(cycle)) return { error: "Invalid billing cycle." };

  if (!stripeConfigured()) {
    redirect(`${BILLING_PATH}/mock-checkout?plan=${plan}&cycle=${cycle}`);
  }

  const priceId = priceIdFor(plan, cycle);
  if (!priceId) return { error: "This plan is not available for self-service checkout yet." };

  const stripe = await getStripe();
  const sub = await getOrCreateSubscription(session.orgId);
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: sub.stripeCustomerId ?? undefined,
    customer_email: sub.stripeCustomerId ? undefined : session.user.email,
    client_reference_id: session.orgId,
    success_url: `${appUrl()}${BILLING_PATH}?checkout=success`,
    cancel_url: `${appUrl()}${BILLING_PATH}?checkout=cancelled`,
    metadata: { organizationId: session.orgId, plan, cycle },
    subscription_data: { metadata: { organizationId: session.orgId, plan, cycle } },
  });
  if (!checkoutSession.url) return { error: "Could not start checkout. Try again." };
  redirect(checkoutSession.url);
}

/** DEV/MOCK ONLY (unreachable when Stripe is configured). Simulates what the
 * webhook does after a successful checkout, so the upgrade flow is fully
 * testable offline. Still server-authorized: session + ADMIN role required. */
export async function confirmMockCheckoutAction(_prev: BillingState, fd: FormData): Promise<BillingState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "ADMIN")) return { error: "Only admins can manage billing." };
  if (stripeConfigured()) return { error: "Mock checkout is disabled when Stripe is configured." };

  const plan = String(fd.get("plan") ?? "");
  const cycle = String(fd.get("cycle") ?? "monthly");
  if (!isPlan(plan) || plan === "enterprise" || !isCycle(cycle)) return { error: "Invalid plan selection." };

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + (cycle === "annual" ? 365 : 30) * 86_400_000);
  await applyCheckoutCompleted({
    organizationId: session.orgId, plan: plan as Plan, cycle,
    stripeCustomerId: `mock_cus_${session.orgId}`, stripeSubscriptionId: `mock_sub_${session.orgId}_${Date.now()}`,
    currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
  });
  revalidatePath(BILLING_PATH);
  redirect(`${BILLING_PATH}?checkout=success`);
}

/** Open the Stripe-hosted billing portal (real Stripe only). */
export async function openPortalAction(): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return;
  if (!stripeConfigured()) redirect(BILLING_PATH); // mock mode: self-service buttons live on the billing page itself

  const sub = await prisma.subscription.findUnique({ where: { organizationId: session.orgId } });
  if (!sub?.stripeCustomerId) redirect(BILLING_PATH);

  const stripe = await getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId, return_url: `${appUrl()}${BILLING_PATH}`,
  });
  redirect(portal.url);
}

/** Cancel at period end. Real Stripe: calls the API (source of truth); the DB
 * is updated from Stripe's own response, never from a client-supplied value. */
export async function cancelSubscriptionAction(): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return;
  const sub = await prisma.subscription.findUnique({ where: { organizationId: session.orgId } });
  if (!sub) return;

  if (stripeConfigured() && sub.stripeSubscriptionId) {
    const stripe = await getStripe();
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: updated.cancel_at_period_end } });
  } else {
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  }
  revalidatePath(BILLING_PATH);
}

export async function resumeSubscriptionAction(): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return;
  const sub = await prisma.subscription.findUnique({ where: { organizationId: session.orgId } });
  if (!sub) return;

  if (stripeConfigured() && sub.stripeSubscriptionId) {
    const stripe = await getStripe();
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: updated.cancel_at_period_end } });
  } else {
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false } });
  }
  revalidatePath(BILLING_PATH);
}
