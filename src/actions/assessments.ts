"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { assessmentSchema } from "@/lib/validation";

export type AssessmentState = { error?: string; fieldErrors?: Record<string, string> };

const initialData = (formData: FormData) => ({
  clientName: formData.get("clientName"),
  type: formData.get("type"),
  status: formData.get("status"),
  scope: formData.get("scope"),
  startDate: formData.get("startDate"),
  endDate: formData.get("endDate"),
  leadConsultant: formData.get("leadConsultant"),
  executiveSummary: formData.get("executiveSummary"),
  notes: formData.get("notes"),
  engagementId: formData.get("engagementId"),
});

/** Resolve an optional engagementId, keeping only ids that belong to the caller's org. */
async function resolveEngagementId(engagementId: string | undefined, orgId: string): Promise<string | null> {
  if (!engagementId) return null;
  const e = await prisma.engagement.findUnique({ where: { id: engagementId } });
  return e && e.organizationId === orgId ? e.id : null;
}

function firstError(err: import("zod").ZodError): AssessmentState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: err.issues[0]?.message ?? "Invalid input.", fieldErrors };
}

/** Create an assessment scoped to the current org. Any member may create. */
export async function createAssessmentAction(_prev: AssessmentState, formData: FormData): Promise<AssessmentState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const parsed = assessmentSchema.safeParse(initialData(formData));
  if (!parsed.success) return firstError(parsed.error);
  const d = parsed.data;
  const engagementId = await resolveEngagementId(d.engagementId, session.orgId);

  const created = await prisma.assessment.create({
    data: {
      organizationId: session.orgId,
      createdById: session.userId,
      engagementId,
      clientName: d.clientName,
      type: d.type,
      status: d.status,
      scope: d.scope ?? null,
      startDate: d.startDate ?? null,
      endDate: d.endDate ?? null,
      leadConsultant: d.leadConsultant ?? null,
      executiveSummary: d.executiveSummary ?? null,
      notes: d.notes ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/assessments");
  redirect(`/dashboard/assessments/${created.id}`);
}

/** Load one assessment, enforcing org scope. Returns null if not found in this org. */
async function loadScoped(id: string, orgId: string) {
  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a || a.organizationId !== orgId) return null;
  return a;
}

/** Update an assessment. Any member may edit. Org-scoped. */
export async function updateAssessmentAction(id: string, _prev: AssessmentState, formData: FormData): Promise<AssessmentState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const existing = await loadScoped(id, session.orgId);
  if (!existing) return { error: "Assessment not found." };

  const parsed = assessmentSchema.safeParse(initialData(formData));
  if (!parsed.success) return firstError(parsed.error);
  const d = parsed.data;
  const engagementId = await resolveEngagementId(d.engagementId, session.orgId);

  await prisma.assessment.update({
    where: { id },
    data: {
      engagementId,
      clientName: d.clientName,
      type: d.type,
      status: d.status,
      scope: d.scope ?? null,
      startDate: d.startDate ?? null,
      endDate: d.endDate ?? null,
      leadConsultant: d.leadConsultant ?? null,
      executiveSummary: d.executiveSummary ?? null,
      notes: d.notes ?? null,
    },
  });

  revalidatePath(`/dashboard/assessments/${id}`);
  revalidatePath("/dashboard/assessments");
  return {};
}

/** Archive / unarchive. Any member. Org-scoped. */
export async function setArchivedAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const id = String(formData.get("id") ?? "");
  const archive = String(formData.get("archive") ?? "") === "1";
  const existing = await loadScoped(id, session.orgId);
  if (!existing) return;

  await prisma.assessment.update({
    where: { id },
    data: { archivedAt: archive ? new Date() : null },
  });
  revalidatePath("/dashboard/assessments");
  revalidatePath(`/dashboard/assessments/${id}`);
}

/** Hard delete. ADMIN or OWNER only (destructive). Org-scoped. */
export async function deleteAssessmentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return;
  const id = String(formData.get("id") ?? "");
  const existing = await loadScoped(id, session.orgId);
  if (!existing) return;

  await prisma.assessment.delete({ where: { id } });
  revalidatePath("/dashboard/assessments");
  redirect("/dashboard/assessments");
}
