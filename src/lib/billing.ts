import "server-only";
import { prisma } from "@/lib/db";
import { PLAN_LIMITS, isPlan, hasPlan, type Plan, type PlanFeatures, underLimit } from "@/lib/plans";
import { sendMail, trialEndingTemplate } from "@/lib/email";
import { logger } from "@/lib/logger";

const TRIAL_DAYS = 14;

/** Get (or lazily provision) the org's subscription row. New orgs start on a
 * 14-day Professional-tier trial so they see the platform's full value. */
export async function getOrCreateSubscription(organizationId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) return existing;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  return prisma.subscription.create({
    data: { organizationId, plan: "professional", status: "trialing", trialEndsAt },
  });
}

/**
 * Lazy sweep: if a trial has lapsed, mark it expired. Idempotent — same
 * pattern as reopenExpiredRiskAcceptances. Call on dashboard-scoped page loads.
 */
export async function sweepTrialExpiry(organizationId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!sub || sub.status !== "trialing" || !sub.trialEndsAt) return;
  if (sub.trialEndsAt.getTime() > Date.now()) return;
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "expired" } });
}

/** The plan tier actually enforced right now — canceled/expired always fall
 * back to Starter-level access regardless of the stored `plan` field (kept
 * for billing history/display). Trialing/active/past_due keep full access at
 * their purchased tier (past_due is a grace period, not a hard lock). */
export function effectivePlan(sub: { plan: string; status: string }): Plan {
  if (sub.status === "canceled" || sub.status === "expired") return "starter";
  return isPlan(sub.plan) ? sub.plan : "starter";
}

export function isSubscriptionUsable(sub: { status: string }): boolean {
  return sub.status === "trialing" || sub.status === "active" || sub.status === "past_due";
}

/** requireRole()'s sibling for commercial gating. Never trust a client-sent plan. */
export function requirePlan(sub: { plan: string; status: string }, min: Plan): boolean {
  return hasPlan(effectivePlan(sub), min);
}

/** Boolean feature-flag check (retest, api, branding, crm, integrations, whiteLabel, sso). */
export function hasFeature(sub: { plan: string; status: string }, feature: keyof PlanFeatures): boolean {
  return PLAN_LIMITS[effectivePlan(sub)].features[feature];
}

function currentPeriodKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getOrCreateUsageCounter(organizationId: string) {
  const period = currentPeriodKey();
  const existing = await prisma.usageCounter.findUnique({ where: { organizationId_period: { organizationId, period } } });
  if (existing) return existing;
  return prisma.usageCounter.create({ data: { organizationId, period } });
}

/** True if the org has AI requests remaining this month under its plan. */
export async function hasAiCreditsRemaining(organizationId: string, sub: { plan: string; status: string }): Promise<boolean> {
  const plan = effectivePlan(sub);
  const limit = PLAN_LIMITS[plan].aiRequestsPerMonth;
  if (limit === null) return true;
  const counter = await getOrCreateUsageCounter(organizationId);
  return underLimit(counter.aiRequests, limit);
}

/** Atomically record one AI request against this month's usage counter. */
export async function recordAiRequest(organizationId: string): Promise<void> {
  const period = currentPeriodKey();
  await prisma.usageCounter.upsert({
    where: { organizationId_period: { organizationId, period } },
    create: { organizationId, period, aiRequests: 1 },
    update: { aiRequests: { increment: 1 } },
  });
}

const TRIAL_ENDING_WINDOW_DAYS = 3;

/**
 * Platform-wide sweep (cron-triggered, not per-request): expire lapsed trials
 * and send the one-time "trial ending soon" email for trials closing within
 * TRIAL_ENDING_WINDOW_DAYS. Idempotent via trialEndingNotifiedAt. Returns
 * counts for the caller to log/report.
 */
export async function sweepAllBillingNotifications(): Promise<{ expired: number; notified: number }> {
  const now = new Date();

  const lapsed = await prisma.subscription.updateMany({
    where: { status: "trialing", trialEndsAt: { lt: now } },
    data: { status: "expired" },
  });

  const soon = new Date(now.getTime() + TRIAL_ENDING_WINDOW_DAYS * 86_400_000);
  const ending = await prisma.subscription.findMany({
    where: { status: "trialing", trialEndsAt: { gte: now, lte: soon }, trialEndingNotifiedAt: null },
    include: { organization: { include: { memberships: { where: { role: { in: ["OWNER", "ADMIN"] } }, include: { user: { select: { email: true } } } } } } },
  });

  let notified = 0;
  for (const sub of ending) {
    try {
      for (const m of sub.organization.memberships) {
        await sendMail({ ...trialEndingTemplate(sub.organization.name, sub.trialEndsAt!), to: m.user.email });
      }
      await prisma.subscription.update({ where: { id: sub.id }, data: { trialEndingNotifiedAt: now } });
      notified++;
    } catch (err) {
      logger.error("Trial-ending notification failed", err, { organizationId: sub.organizationId });
    }
  }

  return { expired: lapsed.count, notified };
}

/** Org-scoped counts used for limit checks (users/engagements/findings/storage). */
export async function orgUsageSnapshot(organizationId: string) {
  const [users, engagements, findings, evidenceAgg] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.engagement.count({ where: { organizationId, archivedAt: null } }),
    prisma.finding.count({ where: { organizationId, archivedAt: null } }),
    prisma.evidence.aggregate({ where: { organizationId, deletedAt: null }, _sum: { sizeBytes: true } }),
  ]);
  return { users, engagements, findings, storageBytes: evidenceAgg._sum.sizeBytes ?? 0 };
}
