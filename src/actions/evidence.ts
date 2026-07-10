"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { evidenceSchema, evidenceUploadSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { storageConfigured, presignUpload, evidenceKey, deleteObject, ALLOWED_EVIDENCE_TYPES, MAX_EVIDENCE_BYTES } from "@/lib/storage";
import { getOrCreateSubscription, effectivePlan, orgStorageUsedBytes, storageAllows } from "@/lib/billing";
import { PLAN_LIMITS } from "@/lib/plans";
import { billingEnabled } from "@/lib/stripe";

export type EvidenceState = { error?: string };

/** Plan gate: would storing `incomingBytes` more evidence exceed the org's storage cap? */
async function storageLimitError(orgId: string, incomingBytes: number): Promise<string | null> {
  if (!billingEnabled()) return null; // billing-disabled mode: no plan caps
  const sub = await getOrCreateSubscription(orgId);
  const cap = PLAN_LIMITS[effectivePlan(sub)].storageBytes;
  if (storageAllows(await orgStorageUsedBytes(orgId), incomingBytes, cap)) return null;
  return "Storage limit reached for your plan. Upgrade in Settings → Billing or delete old evidence.";
}

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
  const capError = await storageLimitError(session.orgId, parsed.data.sizeBytes ?? 0);
  if (capError) return { error: capError };

  await prisma.evidence.create({
    data: {
      organizationId: session.orgId,
      findingId,
      uploadedById: session.userId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes ?? null,
      note: parsed.data.note ?? null,
      storageKey: parsed.data.storageKey ?? null,
    },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "evidence.added",
    detail: parsed.data.filename, assessmentId: finding.assessmentId, findingId,
  });

  revalidatePath(`/dashboard/assessments/${finding.assessmentId}/findings/${findingId}`);
  return {};
}

/** Step 1 of a real file upload: validate + return a presigned PUT URL and object key. */
export async function presignEvidenceUploadAction(
  findingId: string,
  input: { filename: string; contentType: string; size: number }
): Promise<{ error: string } | { url: string; key: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  if (!storageConfigured()) return { error: "File storage is not configured." };

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding || finding.organizationId !== session.orgId) return { error: "Finding not found." };

  const parsed = evidenceUploadSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid file." };
  if (!ALLOWED_EVIDENCE_TYPES[parsed.data.contentType]) return { error: "Unsupported file type. Allowed: PNG, JPG, PDF, TXT, ZIP." };
  if (parsed.data.size > MAX_EVIDENCE_BYTES) return { error: "File exceeds the 25 MB limit." };
  const capError = await storageLimitError(session.orgId, parsed.data.size);
  if (capError) return { error: capError };

  const key = evidenceKey(session.orgId, findingId, parsed.data.filename);
  const url = await presignUpload(key, parsed.data.contentType);
  return { url, key };
}

/** Step 2: register the uploaded object's metadata (after the browser PUT succeeds). */
export async function registerEvidenceAction(
  findingId: string,
  data: { filename: string; mimeType: string; sizeBytes: number; storageKey: string; note?: string }
): Promise<EvidenceState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding || finding.organizationId !== session.orgId) return { error: "Finding not found." };

  const parsed = evidenceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  // Ensure the key is inside this org's namespace (defense in depth).
  if (!parsed.data.storageKey || !parsed.data.storageKey.startsWith(`org/${session.orgId}/`)) {
    return { error: "Invalid storage reference." };
  }
  // Re-check the cap at registration: the presign check ran against
  // pre-upload usage, and this size is what gets metered from here on.
  const capError = await storageLimitError(session.orgId, parsed.data.sizeBytes ?? 0);
  if (capError) return { error: capError };

  await prisma.evidence.create({
    data: {
      organizationId: session.orgId, findingId, uploadedById: session.userId,
      filename: parsed.data.filename, mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes ?? null, note: parsed.data.note ?? null,
      storageKey: parsed.data.storageKey,
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
  // Remove the backing object from storage so deleted evidence does not linger
  // in the bucket (orphaned object / data-retention leak). Best-effort: a failed
  // delete is logged inside deleteObject, not surfaced to the user.
  if (ev.storageKey && storageConfigured()) {
    await deleteObject(ev.storageKey);
  }
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "evidence.deleted",
    detail: ev.filename, assessmentId: ev.finding.assessmentId, findingId: ev.findingId,
  });
  revalidatePath(`/dashboard/assessments/${ev.finding.assessmentId}/findings/${ev.findingId}`);
}
