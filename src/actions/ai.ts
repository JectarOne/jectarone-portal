"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { severityCounts } from "@/lib/report";
import { complete } from "@/lib/ai/provider";
import { AI_CAPABILITIES, buildPrompt, type AiCapability } from "@/lib/ai/prompts";
import { label } from "@/lib/findings";
import { getOrCreateSubscription, reserveAiRequest, releaseAiRequest, effectivePlan } from "@/lib/billing";
import { PLAN_LIMITS } from "@/lib/plans";
import { billingEnabled } from "@/lib/stripe";

export type AiState = { text?: string; error?: string; refused?: boolean; provider?: string };

function isCapability(v: unknown): v is AiCapability {
  return typeof v === "string" && (AI_CAPABILITIES as readonly string[]).includes(v);
}

/**
 * Run an AI-assist capability. MEMBER+ only. Grounding data is always loaded
 * server-side from the caller's own org — the client sends only a capability +
 * a record id, never free-text prompt content — so prompts can't be injected
 * and cross-tenant data can't be reached.
 */
export async function aiAssistAction(_prev: AiState, fd: FormData): Promise<AiState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const capability = fd.get("capability");
  if (!isCapability(capability)) return { error: "Unknown capability." };

  const findingId = String(fd.get("findingId") ?? "");
  const assessmentId = String(fd.get("assessmentId") ?? "");

  let ctx: Record<string, unknown>;
  let logTarget: { assessmentId?: string; findingId?: string } = {};

  if (findingId) {
    const f = await prisma.finding.findUnique({ where: { id: findingId } });
    if (!f || f.organizationId !== session.orgId) return { error: "Finding not found." };
    ctx = {
      title: f.title, severity: label(f.severity), description: f.description,
      technicalDetails: f.technicalDetails, cwe: f.cwe, cvssScore: f.cvssScore, cvssVector: f.cvssVector,
    };
    logTarget = { assessmentId: f.assessmentId, findingId: f.id };
  } else if (assessmentId) {
    const a = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!a || a.organizationId !== session.orgId) return { error: "Assessment not found." };
    const findings = await prisma.finding.findMany({
      where: { organizationId: session.orgId, assessmentId, archivedAt: null },
      select: { title: true, severity: true, cvssScore: true },
      orderBy: { severity: "asc" },
    });
    const counts = severityCounts(findings.map((f) => ({ severity: f.severity })) as never);
    ctx = {
      type: a.type, clientName: a.clientName,
      counts: Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", "),
      score: "",
      findings: findings.map((f) => `- ${f.title} [${label(f.severity)}]${f.cvssScore != null ? ` CVSS ${f.cvssScore}` : ""}`).join("\n"),
    };
    logTarget = { assessmentId };
  } else {
    return { error: "No target provided." };
  }

  const { system, user, maxTokens } = buildPrompt(capability, ctx);

  // Plan-gated AI credits — never trust a client-sent value. The reservation
  // is a single conditional UPDATE (checked against the plan's monthly
  // allowance atomically), so concurrent requests can't overshoot the limit.
  // Billing-disabled mode: no quota (nothing to upgrade to); AiUsageLog below
  // still records every request.
  const metered = billingEnabled();
  if (metered) {
    const sub = await getOrCreateSubscription(session.orgId);
    if (!(await reserveAiRequest(session.orgId, sub))) {
      const limit = PLAN_LIMITS[effectivePlan(sub)].aiRequestsPerMonth;
      return { error: `AI request limit reached for this month (${limit ?? 0} on your plan). Upgrade in Settings → Billing for more.` };
    }
  }

  // The credit is spent once the request reaches the provider, regardless of
  // outcome (refusals included) — but refunded if the call never completes.
  let res;
  try {
    res = await complete({ system, user, maxTokens });
  } catch (err) {
    if (metered) await releaseAiRequest(session.orgId);
    throw err;
  }

  await prisma.aiUsageLog.create({
    data: { organizationId: session.orgId, userId: session.userId, provider: res.provider, capability },
  });

  if (res.refused) return { refused: true, provider: res.provider, error: "The AI provider declined this request." };
  if (!res.text) return { error: "No suggestion was returned. Check the AI provider configuration.", provider: res.provider };

  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "ai.assist",
    detail: capability, ...logTarget,
  });

  return { text: res.text, provider: res.provider };
}
