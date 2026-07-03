"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { findingSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

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
    status: d.status,
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

  const created = await prisma.finding.create({
    data: {
      organizationId: session.orgId,
      assessmentId,
      createdById: session.userId,
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

  await prisma.finding.update({ where: { id }, data: toData(parsed.data) });
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

  await prisma.finding.delete({ where: { id } }); // cascades evidence
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "finding.deleted",
    detail: existing.title, assessmentId: existing.assessmentId, findingId: null,
  });
  revalidatePath(`/dashboard/assessments/${existing.assessmentId}`);
  redirect(`/dashboard/assessments/${existing.assessmentId}`);
}
