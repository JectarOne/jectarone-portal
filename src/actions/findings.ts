"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { findingSchema, statusChangeSchema, assignSchema, acceptRiskSchema, dueDateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { computeDueDate } from "@/lib/sla";
import { STATUS_TRANSITIONS } from "@/lib/findings";

export type FindingState = { error?: string; fieldErrors?: Record<string, string> };

function collect(formData: FormData) {
  const g = (k: string) => formData.get(k);
  return {
    title: g("title"),
    description: g("description"),
    technicalDetails: g("technicalDetails"),
    businessImpact: g("businessImpact"),
    remediation: g("remediation"),
    verificationSteps: g("verificationSteps"),
    severity: g("severity"),
    likelihood: g("likelihood"),
    impact: g("impact"),
    status: g("status"),
    cvssScore: g("cvssScore"),
    cvssVector: g("cvssVector"),
    cwe: g("cwe"),
    owaspCategory: g("owaspCategory"),
    mitreTechnique: g("mitreTechnique"),
    affectedAsset: g("affectedAsset"),
    affectedAssetType: g("affectedAssetType"),
    assetId: g("assetId"),
  };
}

function firstError(err: ZodError): FindingState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: err.issues[0]?.message ?? "Invalid input.", fieldErrors };
}

/** Verify the assessment belongs to the caller's org. Returns it or null. */
async function assessmentInOrg(assessmentId: string, orgId: string) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  return a && a.organizationId === orgId ? a : null;
}

async function findingInOrg(id: string, orgId: string) {
  const f = await prisma.finding.findUnique({ where: { id } });
  return f && f.organizationId === orgId ? f : null;
}

/** Validate that an optional assetId (if supplied) belongs to the caller's org. */
async function resolveAssetId(assetId: string | undefined, orgId: string): Promise<string | null> {
  if (!assetId) return null;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  return asset && asset.organizationId === orgId ? asset.id : null;
}

// Core editable fields (NOT status — status is managed via the workflow action so
// its history is preserved and lifecycle timestamps stay correct).
function toData(d: import("@/lib/validation").FindingInput) {
  return {
    title: d.title,
    description: d.description ?? null,
    technicalDetails: d.technicalDetails ?? null,
    businessImpact: d.businessImpact ?? null,
    remediation: d.remediation ?? null,
    verificationSteps: d.verificationSteps ?? null,
    severity: d.severity,
    likelihood: d.likelihood,
    impact: d.impact,
    cvssScore: d.cvssScore ?? null,
    cvssVector: d.cvssVector ?? null,
    cwe: d.cwe ?? null,
    owaspCategory: d.owaspCategory ?? null,
    mitreTechnique: d.mitreTechnique ?? null,
    affectedAsset: d.affectedAsset ?? null,
    affectedAssetType: d.affectedAssetType ?? null,
  };
}

export async function createFindingAction(assessmentId: string, _prev: FindingState, formData: FormData): Promise<FindingState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const assessment = await assessmentInOrg(assessmentId, session.orgId);
  if (!assessment) return { error: "Assessment not found." };

  const parsed = findingSchema.safeParse(collect(formData));
  if (!parsed.success) return firstError(parsed.error);
  const assetId = await resolveAssetId(parsed.data.assetId, session.orgId);

  const created = await prisma.finding.create({
    data: {
      organizationId: session.orgId,
      assessmentId,
      createdById: session.userId,
      assetId,
      status: "Open",
      dueDate: computeDueDate(parsed.data.severity), // SLA auto-calc from severity
      ...toData(parsed.data),
    },
    select: { id: true, title: true },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.created",
    detail: created.title, assessmentId, findingId: created.id,
  });

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  redirect(`/dashboard/assessments/${assessmentId}/findings/${created.id}`);
}

export async function updateFindingAction(id: string, _prev: FindingState, formData: FormData): Promise<FindingState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const existing = await findingInOrg(id, session.orgId);
  if (!existing) return { error: "Finding not found." };

  const parsed = findingSchema.safeParse(collect(formData));
  if (!parsed.success) return firstError(parsed.error);
  const assetId = await resolveAssetId(parsed.data.assetId, session.orgId);

  // Severity change → recompute SLA due date (unless manually overridden) + audit it.
  const severityChanged = existing.severity !== parsed.data.severity;
  const recomputedDue = severityChanged && !existing.slaOverridden
    ? computeDueDate(parsed.data.severity, existing.createdAt)
    : undefined;

  await prisma.finding.update({
    where: { id },
    data: { ...toData(parsed.data), assetId, ...(recomputedDue !== undefined ? { dueDate: recomputedDue } : {}) },
  });
  if (severityChanged) {
    await logActivity({
      organizationId: session.orgId, userId: session.userId, action: "finding.severity_changed",
      detail: `${existing.severity} → ${parsed.data.severity}`, assessmentId: existing.assessmentId, findingId: id,
    });
  }
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.edited",
    detail: parsed.data.title, assessmentId: existing.assessmentId, findingId: id,
  });

  revalidatePath(`/dashboard/assessments/${existing.assessmentId}/findings/${id}`);
  return {};
}

export async function setFindingArchivedAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const id = String(formData.get("id") ?? "");
  const archive = String(formData.get("archive") ?? "") === "1";
  const existing = await findingInOrg(id, session.orgId);
  if (!existing) return;

  await prisma.finding.update({ where: { id }, data: { archivedAt: archive ? new Date() : null } });
  await logActivity({
    organizationId: session.orgId, userId: session.userId,
    action: archive ? "finding.archived" : "finding.restored",
    detail: existing.title, assessmentId: existing.assessmentId, findingId: id,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}/findings/${id}`);
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}`);
}

export async function deleteFindingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return; // ADMIN+ only
  const id = String(formData.get("id") ?? "");
  const existing = await findingInOrg(id, session.orgId);
  if (!existing) return;

  await prisma.finding.delete({ where: { id } }); // cascades evidence + comments
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.deleted",
    detail: existing.title, assessmentId: existing.assessmentId, findingId: null,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}`);
  redirect(`/dashboard/assessments/${existing.assessmentId}`);
}

/* ---------- Sprint 5 workflow actions ---------- */

/** Change status through the workflow; preserves history + sets lifecycle timestamps. */
export async function changeStatusAction(findingId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const existing = await findingInOrg(findingId, session.orgId);
  if (!existing) return;

  const parsed = statusChangeSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return;
  const next = parsed.data.status;
  if (next === existing.status) return;

  // Enforce allowed transitions (legacy statuses fall through to a permissive default).
  const allowed = STATUS_TRANSITIONS[existing.status] ?? Object.keys(STATUS_TRANSITIONS);
  if (!allowed.includes(next)) return;

  const now = new Date();
  const data: Record<string, unknown> = { status: next };
  if (next === "Resolved") data.resolvedAt = now;
  if (next === "ReadyForValidation") data.validatedAt = null;
  if (next === "Open") { data.resolvedAt = null; data.validatedAt = null; } // reopen clears
  if (next !== "AcceptedRisk") {
    // leaving accepted-risk clears the acceptance record
    data.acceptedRiskReason = null; data.acceptedRiskById = null; data.acceptedRiskAt = null; data.acceptedRiskUntil = null;
  }

  await prisma.finding.update({ where: { id: findingId }, data });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.status_changed",
    detail: `${existing.status} → ${next}`, assessmentId: existing.assessmentId, findingId,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}/findings/${findingId}`);
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}`);
}

/** Assign (or unassign) a finding to a user in the same org. */
export async function assignFindingAction(findingId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const existing = await findingInOrg(findingId, session.orgId);
  if (!existing) return;

  const parsed = assignSchema.safeParse({ assigneeId: formData.get("assigneeId") });
  if (!parsed.success) return;
  const assigneeId = parsed.data.assigneeId;

  let resolved: string | null = null;
  let assigneeName = "Unassigned";
  if (assigneeId) {
    // Only members of the same org can be assigned.
    const m = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: assigneeId, organizationId: session.orgId } },
      include: { user: { select: { name: true } } },
    });
    if (!m) return;
    resolved = assigneeId;
    assigneeName = m.user.name;
  }
  if (resolved === (existing.assigneeId ?? null)) return;

  await prisma.finding.update({
    where: { id: findingId },
    data: {
      assigneeId: resolved,
      assignedById: resolved ? session.userId : null,
      assignedAt: resolved ? new Date() : null,
    },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.assigned",
    detail: assigneeName, assessmentId: existing.assessmentId, findingId,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}/findings/${findingId}`);
}

/** Manually override the SLA due date. */
export async function setDueDateAction(findingId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const existing = await findingInOrg(findingId, session.orgId);
  if (!existing) return;

  const parsed = dueDateSchema.safeParse({ dueDate: formData.get("dueDate") });
  if (!parsed.success) return;
  const due = parsed.data.dueDate ?? null;

  await prisma.finding.update({ where: { id: findingId }, data: { dueDate: due, slaOverridden: true } });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.due_changed",
    detail: due ? due.toISOString().slice(0, 10) : "cleared", assessmentId: existing.assessmentId, findingId,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}/findings/${findingId}`);
}

/** Accept the risk of a finding with a justification + optional expiry. */
export async function acceptRiskAction(findingId: string, _prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const existing = await findingInOrg(findingId, session.orgId);
  if (!existing) return { error: "Finding not found." };

  const parsed = acceptRiskSchema.safeParse({ reason: formData.get("reason"), until: formData.get("until") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.finding.update({
    where: { id: findingId },
    data: {
      status: "AcceptedRisk",
      acceptedRiskReason: parsed.data.reason,
      acceptedRiskById: session.userId,
      acceptedRiskAt: new Date(),
      acceptedRiskUntil: parsed.data.until ?? null,
    },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.risk_accepted",
    detail: parsed.data.until ? `until ${parsed.data.until.toISOString().slice(0, 10)}` : "no expiry",
    assessmentId: existing.assessmentId, findingId,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}/findings/${findingId}`);
  return {};
}
