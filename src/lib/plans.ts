// Subscription plan catalog. Plans are code-defined (validated strings), same
// pattern as roles/severities/statuses elsewhere — no DB table to seed/drift.
// Limits gate features server-side; a plan is never trusted from the client.

export const PLANS = ["starter", "professional", "business", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

const RANK: Record<Plan, number> = { starter: 0, professional: 1, business: 2, enterprise: 3 };

export function isPlan(v: string): v is Plan {
  return (PLANS as readonly string[]).includes(v);
}

/** True if `plan` meets or exceeds `min` in the tier hierarchy. */
export function hasPlan(plan: string, min: Plan): boolean {
  if (!isPlan(plan)) return false;
  return RANK[plan] >= RANK[min];
}

export type PlanFeatures = {
  retest: boolean;
  api: boolean;
  branding: boolean;
  crm: boolean;
  integrations: boolean;
  whiteLabel: boolean;
  sso: boolean;
};

export type PlanLimits = {
  maxUsers: number | null; // null = unlimited
  maxEngagements: number | null;
  maxFindings: number | null;
  storageBytes: number | null;
  aiRequestsPerMonth: number | null;
  features: PlanFeatures;
};

const GB = 1024 * 1024 * 1024;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  starter: {
    maxUsers: 2, maxEngagements: 5, maxFindings: 100, storageBytes: 1 * GB, aiRequestsPerMonth: 250,
    features: { retest: false, api: false, branding: false, crm: false, integrations: false, whiteLabel: false, sso: false },
  },
  professional: {
    maxUsers: 10, maxEngagements: null, maxFindings: null, storageBytes: 100 * GB, aiRequestsPerMonth: 5000,
    features: { retest: true, api: true, branding: true, crm: false, integrations: false, whiteLabel: false, sso: false },
  },
  business: {
    maxUsers: null, maxEngagements: null, maxFindings: null, storageBytes: null, aiRequestsPerMonth: null,
    features: { retest: true, api: true, branding: true, crm: true, integrations: true, whiteLabel: true, sso: false },
  },
  enterprise: {
    maxUsers: null, maxEngagements: null, maxFindings: null, storageBytes: null, aiRequestsPerMonth: null,
    features: { retest: true, api: true, branding: true, crm: true, integrations: true, whiteLabel: true, sso: true },
  },
};

const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter", professional: "Professional", business: "Business", enterprise: "Enterprise",
};
export function planLabel(plan: string): string {
  return (PLAN_LABELS as Record<string, string>)[plan] ?? plan;
}

const PLAN_PRICE_CENTS: Record<Plan, { monthly: number; annual: number }> = {
  starter: { monthly: 3900, annual: 3900 * 10 }, // ~2 months free annually
  professional: { monthly: 14900, annual: 14900 * 10 },
  business: { monthly: 39900, annual: 39900 * 10 },
  enterprise: { monthly: 0, annual: 0 }, // custom — no self-serve price
};
export function planPriceCents(plan: string, cycle: "monthly" | "annual"): number {
  const p = isPlan(plan) ? plan : "starter";
  return PLAN_PRICE_CENTS[p][cycle];
}

/** Numeric limit check: null limit = unlimited (always allowed). */
export function underLimit(current: number, limit: number | null): boolean {
  return limit === null || current < limit;
}

export function limitLabel(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}
