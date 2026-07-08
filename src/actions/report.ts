"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { parseConfig } from "@/lib/report-config";

export type ReportConfigState = { error?: string; ok?: boolean };

/** Save the report builder config for an assessment (MEMBER+, org-scoped). */
export async function saveReportConfigAction(assessmentId: string, _prev: ReportConfigState, fd: FormData): Promise<ReportConfigState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment || assessment.organizationId !== session.orgId) return { error: "Assessment not found." };

  // Re-parse through parseConfig to sanitize/validate the incoming JSON.
  const clean = parseConfig(String(fd.get("config") ?? "{}"));
  clean.customRecommendations = (String(fd.get("customRecommendations") ?? "").trim() || null);
  clean.appendix = (String(fd.get("appendix") ?? "").trim() || null);
  const execSummary = String(fd.get("executiveSummary") ?? "").trim() || null;

  await prisma.$transaction([
    prisma.reportConfig.upsert({
      where: { assessmentId },
      create: { assessmentId, organizationId: session.orgId, config: JSON.stringify(clean), updatedById: session.userId },
      update: { config: JSON.stringify(clean), updatedById: session.userId },
    }),
    prisma.assessment.update({ where: { id: assessmentId }, data: { executiveSummary: execSummary } }),
  ]);

  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "report.config_saved", assessmentId });
  revalidatePath(`/dashboard/assessments/${assessmentId}/report/builder`);
  return { ok: true };
}
