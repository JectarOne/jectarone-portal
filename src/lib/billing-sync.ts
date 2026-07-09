import "server-only";
// Shared subscription state-transition logic. This is the ONLY code path that
// writes plan/status — called by:
//   1. The real Stripe webhook route, after signature verification (production
//      source of truth — see src/app/api/webhooks/stripe/route.ts).
//   2. The dev/CI mock-checkout flow when STRIPE_SECRET_KEY is unset (never
//      reachable in a configured-Stripe deployment — see src/actions/billing.ts).
// Neither caller ever trusts a plan/status value supplied by the browser.

import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { logger } from "@/lib/logger";
import {
  sendMail, paymentSucceededTemplate, paymentFailedTemplate,
  subscriptionCancelledTemplate, planUpgradedTemplate,
} from "@/lib/email";
import { mapStripeStatus, planForPriceId } from "@/lib/stripe";
import { isPlan, type Plan } from "@/lib/plans";

async function ownerEmails(organizationId: string): Promise<string[]> {
  const owners = await prisma.membership.findMany({
    where: { organizationId, role: { in: ["OWNER", "ADMIN"] } },
    include: { user: { select: { email: true } } },
  });
  return owners.map((m) => m.user.email);
}

async function notify(organizationId: string, orgName: string, build: (orgName: string) => { to: string; subject: string; text: string; html?: string }) {
  try {
    for (const to of await ownerEmails(organizationId)) {
      await sendMail({ ...build(orgName), to });
    }
  } catch (err) {
    logger.error("Billing notification email failed", err, { organizationId });
  }
}

/** Checkout completed: activate the subscription for the org. */
export async function applyCheckoutCompleted(input: {
  organizationId: string; plan: Plan; cycle: "monthly" | "annual";
  stripeCustomerId?: string | null; stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date | null; currentPeriodEnd?: Date | null;
}): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { name: true } });
  if (!org) return;

  await prisma.subscription.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId, plan: input.plan, status: "active", billingCycle: input.cycle,
      stripeCustomerId: input.stripeCustomerId ?? null, stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      currentPeriodStart: input.currentPeriodStart ?? new Date(),
      currentPeriodEnd: input.currentPeriodEnd ?? null, trialEndsAt: null,
    },
    update: {
      plan: input.plan, status: "active", billingCycle: input.cycle,
      stripeCustomerId: input.stripeCustomerId ?? undefined, stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      currentPeriodStart: input.currentPeriodStart ?? undefined, currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      trialEndsAt: null, cancelAtPeriodEnd: false,
    },
  });
  await logActivity({ organizationId: input.organizationId, userId: null, action: "billing.subscribed", detail: `${input.plan}/${input.cycle}` });
  await notify(input.organizationId, org.name, (name) => planUpgradedTemplate(name, input.plan));
}

/** `customer.subscription.updated` — status/plan/period changed on Stripe's side. */
export async function applySubscriptionUpdated(input: {
  stripeSubscriptionId: string; stripeStatus: string; priceId?: string | null;
  currentPeriodStart?: Date | null; currentPeriodEnd?: Date | null; cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: input.stripeSubscriptionId } });
  if (!sub) return; // unknown subscription — ignore (e.g. test-mode noise)

  const plan = input.priceId ? planForPriceId(input.priceId) : null;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: mapStripeStatus(input.stripeStatus),
      ...(plan ? { plan } : {}),
      currentPeriodStart: input.currentPeriodStart ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? undefined,
    },
  });
  await logActivity({ organizationId: sub.organizationId, userId: null, action: "billing.subscription_updated", detail: input.stripeStatus });
}

/** `customer.subscription.deleted` — subscription ended (cancel took effect). */
export async function applySubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  if (!sub) return;
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "canceled", cancelAtPeriodEnd: true } });
  const org = await prisma.organization.findUnique({ where: { id: sub.organizationId }, select: { name: true } });
  await logActivity({ organizationId: sub.organizationId, userId: null, action: "billing.subscription_canceled" });
  if (org) await notify(sub.organizationId, org.name, (name) => subscriptionCancelledTemplate(name, sub.currentPeriodEnd));
}

/** `invoice.payment_succeeded`. */
export async function applyInvoicePaymentSucceeded(input: {
  stripeCustomerId: string; stripeInvoiceId: string; number?: string | null;
  amountPaidCents: number; currency: string; invoicePdf?: string | null;
}): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { stripeCustomerId: input.stripeCustomerId } });
  if (!sub) return;

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: input.stripeInvoiceId },
    create: {
      organizationId: sub.organizationId, stripeInvoiceId: input.stripeInvoiceId, number: input.number ?? null,
      amountPaidCents: input.amountPaidCents, currency: input.currency, status: "paid", invoicePdf: input.invoicePdf ?? null,
    },
    update: { status: "paid", amountPaidCents: input.amountPaidCents, invoicePdf: input.invoicePdf ?? undefined },
  });
  if (sub.status === "past_due") {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "active" } });
  }
  const org = await prisma.organization.findUnique({ where: { id: sub.organizationId }, select: { name: true } });
  if (org) await notify(sub.organizationId, org.name, (name) => paymentSucceededTemplate(name, input.amountPaidCents, input.currency));
}

/** `invoice.payment_failed`. */
export async function applyInvoicePaymentFailed(stripeCustomerId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { stripeCustomerId } });
  if (!sub) return;
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
  const org = await prisma.organization.findUnique({ where: { id: sub.organizationId }, select: { name: true } });
  await logActivity({ organizationId: sub.organizationId, userId: null, action: "billing.payment_failed" });
  if (org) await notify(sub.organizationId, org.name, (name) => paymentFailedTemplate(name));
}

export { isPlan };
export type { Plan };
