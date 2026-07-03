"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { commentSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export type CommentState = { error?: string };

async function findingInOrg(id: string, orgId: string) {
  const f = await prisma.finding.findUnique({ where: { id } });
  return f && f.organizationId === orgId ? f : null;
}

export async function addCommentAction(findingId: string, _prev: CommentState, formData: FormData): Promise<CommentState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const finding = await findingInOrg(findingId, session.orgId);
  if (!finding) return { error: "Finding not found." };

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid comment." };

  await prisma.findingComment.create({
    data: { organizationId: session.orgId, findingId, authorId: session.userId, body: parsed.data.body },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "comment.added",
    assessmentId: finding.assessmentId, findingId,
  });
  revalidatePath(`/dashboard/assessments/${finding.assessmentId}/findings/${findingId}`);
  return {};
}

/** Edit own comment (author only). */
export async function editCommentAction(commentId: string, _prev: CommentState, formData: FormData): Promise<CommentState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const c = await prisma.findingComment.findUnique({ where: { id: commentId }, include: { finding: true } });
  if (!c || c.organizationId !== session.orgId || c.deletedAt) return { error: "Comment not found." };
  if (c.authorId !== session.userId) return { error: "You can only edit your own comment." };

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid comment." };

  await prisma.findingComment.update({ where: { id: commentId }, data: { body: parsed.data.body, editedAt: new Date() } });
  revalidatePath(`/dashboard/assessments/${c.finding.assessmentId}/findings/${c.findingId}`);
  return {};
}

/** Soft-delete own comment (author; ADMIN+ may remove any). */
export async function deleteCommentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  const c = await prisma.findingComment.findUnique({ where: { id }, include: { finding: true } });
  if (!c || c.organizationId !== session.orgId || c.deletedAt) return;
  if (c.authorId !== session.userId && !hasRole(session.role, "ADMIN")) return;

  await prisma.findingComment.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath(`/dashboard/assessments/${c.finding.assessmentId}/findings/${c.findingId}`);
}
