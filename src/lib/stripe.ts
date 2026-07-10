import "server-only";
import type Stripe from "stripe";
import { isPlan, type Plan } from "@/lib/plans";

/** True when real Stripe keys are configured. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Dev/CI mock billing: no Stripe keys, but BILLING_MODE=mock is set
 * explicitly (Playwright/local dev). Never active alongside real Stripe. */
export function billingMockMode(): boolean {
  return !stripeConfigured() && process.env.BILLING_MODE === "mock";
}

/**
 * Billing runs in one of three modes:
 *   stripe   — STRIPE_SECRET_KEY set: real Checkout/Portal/webhooks.
 *   mock     — BILLING_MODE=mock: offline mock checkout (dev/CI).
 *   disabled — neither: billing UI shows "coming soon", checkout actions
 *              no-op, plan limits are not enforced, and no trials are
 *              created. The app must degrade gracefully, never error.
 */
export function billingEnabled(): boolean {
  return stripeConfigured() || billingMockMode();
}

let _client: Stripe | null = null;
/** Lazily construct the Stripe client — only imported when a key is present. */
export async function getStripe(): Promise<Stripe> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!_client) {
    const { default: StripeSdk } = await import("stripe");
    _client = new StripeSdk(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-06-24.dahlia" });
  }
  return _client;
}

/** Resolve the Stripe Price ID for a plan + billing cycle from env vars. */
export function priceIdFor(plan: Plan, cycle: "monthly" | "annual"): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  return process.env[key] || process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] || null;
}

/** Reverse-lookup: which plan does this Stripe Price ID belong to? */
export function planForPriceId(priceId: string): Plan | null {
  for (const plan of ["starter", "professional", "business", "enterprise"] as const) {
    if (priceIdFor(plan, "monthly") === priceId || priceIdFor(plan, "annual") === priceId) return plan;
  }
  return null;
}

export function mapStripeStatus(status: string): string {
  // Stripe: trialing|active|past_due|canceled|unpaid|incomplete|incomplete_expired|paused
  if (status === "trialing" || status === "active" || status === "past_due" || status === "canceled") return status;
  // Everything else — unpaid, incomplete, incomplete_expired, paused, and any
  // status Stripe adds later — means "not in good standing". Deny by default:
  // mapping an unrecognized status to "active" would grant paid-tier access
  // without payment (e.g. `paused` = trial ended with no payment method).
  return "expired";
}

export { isPlan };
