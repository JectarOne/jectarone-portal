"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { evidenceSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export type EvidenceState = { error?: string };

/** Register evidence metadata against a finding (binary storage is a future integration). */
export async function addEvidenceAction(findingId: string, _prev: EvidenceState, formData: FormData): Promise<EvidenceState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding || finding.organizationId !== session.orgId) return { error: "Finding not found." };

  const parsed = evidenceSchema.safeParse({
    filename: formData.get("filename"),
    mimeType: formData.get("mimeType"),
    sizeBytes: formData.get("sizeBytes"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.evidence.create({
    data: {
      organizationId: session.orgId,
      findingId,
      uploadedById: session.userId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes ?? null,
      note: parsed.data.note ?? null,
    },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "evidence.added",
    detail: parsed.data.filename, assessmentId: finding.assessmentId, findingId,
  });

  revalidatePath(`/dashboard/assessments/${finding.assessmentId}/findings/${findingId}`);
  return {};
}

export async function deleteEvidenceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const id = String(formData.get("id") ?? "");

  // Evidence ownership: must belong to the caller's org.
  const ev = await prisma.evidence.findUnique({ where: { id }, include: { finding: true } });
  if (!ev || ev.organizationId !== session.orgId || ev.deletedAt) return;

  await prisma.evidence.update({ where: { id }, data: { deletedAt: new Date() } }); // soft delete
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "evidence.deleted",
    detail: ev.filename, assessmentId: ev.finding.assessmentId, findingId: ev.findingId,
  });
  revalidatePath(`/dashboard/assessments/${ev.finding.assessmentId}/findings/${ev.findingId}`);
}
