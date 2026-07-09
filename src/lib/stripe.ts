import "server-only";
import type Stripe from "stripe";
import { isPlan, type Plan } from "@/lib/plans";

/** True when real Stripe keys are configured. False = dev/CI mock mode. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
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
  if (status === "unpaid" || status === "incomplete_expired") return "expired";
  return "active";
}

export { isPlan };
