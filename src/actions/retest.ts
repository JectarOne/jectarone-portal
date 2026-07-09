"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { canRetestTransition, isRetestOpen, retestStatusLabel } from "@/lib/retest";

export type RetestState = { error?: string };

async function findingInOrg(id: string, orgId: string) {
  const f = await prisma.finding.findUnique({ where: { id } });
  return f && f.organizationId === orgId ? f : null;
}
async function retestInOrg(id: string, orgId: string) {
  const r = await prisma.retest.findUnique({ where: { id } });
  return r && r.organizationId === orgId ? r : null;
}
function pathFor(f: { assessmentId: string; id: string }) {
  return `/dashboard/assessments/${f.assessmentId}/findings/${f.id}`;
}

/** Request a retest for a finding. One open retest per finding at a time. */
export async function requestRetestAction(findingId: string, _prev: RetestState, fd: FormData): Promise<RetestState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const finding = await findingInOrg(findingId, session.orgId);
  if (!finding) return { error: "Finding not found." };

  const openExisting = await prisma.retest.findFirst({
    where: { findingId, status: { notIn: ["Verified", "Failed"] } },
  });
  if (openExisting) return { error: "A retest is already in progress for this finding." };

  // Optional assignee must be a member of the same org.
  const assigneeId = String(fd.get("assignedToId") ?? "") || null;
  let resolvedAssignee: string | null = null;
  if (assigneeId) {
    const m = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: assigneeId, organizationId: session.orgId } },
    });
    resolvedAssignee = m ? assigneeId : null;
  }
  const dueRaw = String(fd.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(dueRaw) : null;

  const created = await prisma.retest.create({
    data: {
      organizationId: session.orgId, findingId, status: "Requested",
      requestedById: session.userId, assignedToId: resolvedAssignee, dueDate,
    },
    select: { id: true },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "retest.requested",
    assessmentId: finding.assessmentId, findingId,
  });
  revalidatePath(pathFor(finding));
  return {};
}

/** Advance a retest through Scheduled / InProgress (with optional schedule date). */
export async function advanceRetestAction(retestId: string, fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const rt = await retestInOrg(retestId, session.orgId);
  if (!rt) return;
  const next = String(fd.get("retestStatus") ?? "");
  if (!canRetestTransition(rt.status, next)) return;

  const scheduledRaw = String(fd.get("scheduledFor") ?? "");
  const data: Record<string, unknown> = { status: next };
  if (next === "Scheduled" && scheduledRaw) data.scheduledFor = new Date(scheduledRaw);

  const finding = await prisma.finding.findUnique({ where: { id: rt.findingId }, select: { id: true, assessmentId: true } });
  await prisma.retest.update({ where: { id: retestId }, data });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "retest.status_changed",
    detail: `${retestStatusLabel(rt.status)} → ${retestStatusLabel(next)}`,
    assessmentId: finding?.assessmentId, findingId: rt.findingId,
  });
  if (finding) revalidatePath(pathFor(finding));
}

/** Complete a retest: Verified (finding resolved) or Failed (finding reopened). */
export async function completeRetestAction(retestId: string, fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const rt = await retestInOrg(retestId, session.orgId);
  if (!rt || !isRetestOpen(rt.status)) return;
  const outcome = String(fd.get("outcome") ?? ""); // "Verified" | "Failed"
  if (outcome !== "Verified" && outcome !== "Failed") return;
  if (!canRetestTransition(rt.status, outcome)) return;

  const result = String(fd.get("result") ?? "").trim().slice(0, 4000) || null;
  const finding = await prisma.finding.findUnique({ where: { id: rt.findingId }, select: { id: true, assessmentId: true } });

  await prisma.$transaction([
    prisma.retest.update({ where: { id: retestId }, data: { status: outcome, completedAt: new Date(), result } }),
    // Verified → finding Resolved; Failed → reopened to Open.
    prisma.finding.update({
      where: { id: rt.findingId },
      data: outcome === "Verified"
        ? { status: "Resolved", resolvedAt: new Date() }
        : { status: "Open", resolvedAt: null },
    }),
  ]);
  await logActivity({
    organizationId: session.orgId, userId: session.userId,
    action: outcome === "Verified" ? "retest.verified" : "retest.failed",
    detail: result ?? undefined, assessmentId: finding?.assessmentId, findingId: rt.findingId,
  });
  if (finding) revalidatePath(pathFor(finding));
}

/** Save consultant / client notes on a retest. */
export async function saveRetestNotesAction(retestId: string, fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const rt = await retestInOrg(retestId, session.orgId);
  if (!rt) return;
  const consultantNotes = String(fd.get("consultantNotes") ?? "").trim().slice(0, 8000) || null;
  const clientNotes = String(fd.get("clientNotes") ?? "").trim().slice(0, 8000) || null;
  const finding = await prisma.finding.findUnique({ where: { id: rt.findingId }, select: { id: true, assessmentId: true } });
  await prisma.retest.update({ where: { id: retestId }, data: { consultantNotes, clientNotes } });
  if (finding) revalidatePath(pathFor(finding));
}
