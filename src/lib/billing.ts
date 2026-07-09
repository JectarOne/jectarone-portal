import "server-only";
import { prisma } from "@/lib/db";
import { PLAN_LIMITS, isPlan, hasPlan, type Plan, type PlanFeatures } from "@/lib/plans";
import { sendMail, trialEndingTemplate } from "@/lib/email";
import { logger } from "@/lib/logger";

const TRIAL_DAYS = 14;

/** Row data for a brand-new 14-day Professional-tier trial — the single source
 * of truth for trial defaults, used by signup (eager, inside its transaction)
 * and getOrCreateSubscription (lazy, for orgs that pre-date billing). */
export function newTrialSubscriptionData(organizationId: string) {
  return {
    organizationId,
    plan: "professional",
    status: "trialing",
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
  };
}

/** Get (or lazily provision) the org's subscription row. New orgs start on a
 * 14-day Professional-tier trial so they see the platform's full value. */
export async function getOrCreateSubscription(organizationId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.subscription.create({ data: newTrialSubscriptionData(organizationId) });
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

/** Ensure this month's counter row exists. createMany+skipDuplicates is atomic
 * under the unique constraint, where a read-then-create pair can throw P2002
 * when two requests race on the first hit of a new month. */
async function ensureUsageCounter(organizationId: string, period: string): Promise<void> {
  await prisma.usageCounter.createMany({ data: [{ organizationId, period }], skipDuplicates: true });
}

export async function getOrCreateUsageCounter(organizationId: string) {
  const period = currentPeriodKey();
  await ensureUsageCounter(organizationId, period);
  return prisma.usageCounter.findUniqueOrThrow({ where: { organizationId_period: { organizationId, period } } });
}

/**
 * Atomically reserve one AI request against this month's counter, enforcing
 * the plan's monthly allowance in the same UPDATE (`aiRequests < limit` in the
 * WHERE clause). A separate check-then-increment pair would let concurrent
 * requests all pass the check and overshoot the limit. Returns false when the
 * allowance is used up.
 */
export async function reserveAiRequest(organizationId: string, sub: { plan: string; status: string }): Promise<boolean> {
  const limit = PLAN_LIMITS[effectivePlan(sub)].aiRequestsPerMonth;
  const period = currentPeriodKey();
  await ensureUsageCounter(organizationId, period);
  const reserved = await prisma.usageCounter.updateMany({
    where: { organizationId, period, ...(limit === null ? {} : { aiRequests: { lt: limit } }) },
    data: { aiRequests: { increment: 1 } },
  });
  return reserved.count === 1;
}

/** Refund a reservation whose request never reached the provider. */
export async function releaseAiRequest(organizationId: string): Promise<void> {
  await prisma.usageCounter.updateMany({
    where: { organizationId, period: currentPeriodKey(), aiRequests: { gt: 0 } },
    data: { aiRequests: { decrement: 1 } },
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

/** Bytes of (non-deleted) evidence the org currently stores. */
export async function orgStorageUsedBytes(organizationId: string): Promise<number> {
  const agg = await prisma.evidence.aggregate({ where: { organizationId, deletedAt: null }, _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}

/** True if adding `incomingBytes` keeps the org within its plan's storage cap. */
export function storageAllows(usedBytes: number, incomingBytes: number, limit: number | null): boolean {
  return limit === null || usedBytes + incomingBytes <= limit;
}

/** Org-scoped counts used for limit checks (users/engagements/findings/storage). */
export async function orgUsageSnapshot(organizationId: string) {
  const [users, engagements, findings, storageBytes] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.engagement.count({ where: { organizationId, archivedAt: null } }),
    prisma.finding.count({ where: { organizationId, archivedAt: null } }),
    orgStorageUsedBytes(organizationId),
  ]);
  return { users, engagements, findings, storageBytes };
}
