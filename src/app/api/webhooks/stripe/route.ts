import { NextResponse } from "next/server";
import { stripeConfigured, getStripe } from "@/lib/stripe";
import { isPlan } from "@/lib/plans";
import {
  applyCheckoutCompleted, applySubscriptionUpdated, applySubscriptionDeleted,
  applyInvoicePaymentSucceeded, applyInvoicePaymentFailed,
} from "@/lib/billing-sync";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

/**
 * Stripe webhook — the ONLY production path that writes subscription state.
 * The signature is verified against STRIPE_WEBHOOK_SECRET before any event is
 * trusted; an unverifiable payload is rejected outright. Route is inert
 * (503) when Stripe isn't configured, so it's safe to leave registered.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is unset", undefined);
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const stripe = await getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const organizationId = s.metadata?.organizationId ?? s.client_reference_id;
        const plan = s.metadata?.plan;
        const cycle = s.metadata?.cycle === "annual" ? "annual" : "monthly";
        if (organizationId && plan && isPlan(plan) && plan !== "enterprise") {
          const subscriptionId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
          let periodStart: Date | undefined; let periodEnd: Date | undefined;
          if (subscriptionId) {
            const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
            // Current-period timestamps live on the subscription item, not the
            // subscription itself, as of API version 2026-06-24.
            const item = stripeSub.items.data[0];
            if (item) {
              periodStart = new Date(item.current_period_start * 1000);
              periodEnd = new Date(item.current_period_end * 1000);
            }
          }
          await applyCheckoutCompleted({
            organizationId, plan, cycle,
            stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id,
            stripeSubscriptionId: subscriptionId,
            currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const s = event.data.object as Stripe.Subscription;
        const item = s.items.data[0];
        const priceId = item?.price?.id ?? null;
        await applySubscriptionUpdated({
          stripeSubscriptionId: s.id, stripeStatus: s.status, priceId,
          currentPeriodStart: item ? new Date(item.current_period_start * 1000) : undefined,
          currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : undefined,
          cancelAtPeriodEnd: s.cancel_at_period_end,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const s = event.data.object as Stripe.Subscription;
        await applySubscriptionDeleted(s.id);
        break;
      }
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (typeof inv.customer === "string") {
          await applyInvoicePaymentSucceeded({
            stripeCustomerId: inv.customer, stripeInvoiceId: inv.id, number: inv.number,
            amountPaidCents: inv.amount_paid, currency: inv.currency, invoicePdf: inv.invoice_pdf,
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (typeof inv.customer === "string") await applyInvoicePaymentFailed(inv.customer);
        break;
      }
      default:
        break; // ignore event types we don't act on
    }
  } catch (err) {
    logger.error("Stripe webhook handler error", err, { eventType: event.type });
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
