"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { engagementSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { canTransition, engagementStatusLabel } from "@/lib/engagements";
import { getOrCreateSubscription, effectivePlan } from "@/lib/billing";
import { PLAN_LIMITS, underLimit, limitLabel } from "@/lib/plans";
import { billingEnabled } from "@/lib/stripe";

export type EngagementState = { error?: string; fieldErrors?: Record<string, string> };

function collect(fd: FormData) {
  const g = (k: string) => fd.get(k);
  return {
    name: g("name"), clientName: g("clientName"), status: g("status"),
    scope: g("scope"), startDate: g("startDate"), endDate: g("endDate"), leadConsultant: g("leadConsultant"),
  };
}

function firstError(err: ZodError): EngagementState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: err.issues[0]?.message ?? "Invalid input.", fieldErrors };
}

function toData(d: import("@/lib/validation").EngagementInput) {
  return {
    name: d.name, clientName: d.clientName, status: d.status,
    scope: d.scope ?? null, startDate: d.startDate ?? null, endDate: d.endDate ?? null,
    leadConsultant: d.leadConsultant ?? null,
  };
}

async function ownEngagement(id: string, orgId: string) {
  const e = await prisma.engagement.findUnique({ where: { id } });
  return e && e.organizationId === orgId ? e : null;
}

export async function createEngagementAction(_prev: EngagementState, fd: FormData): Promise<EngagementState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  if (billingEnabled()) {
    const sub = await getOrCreateSubscription(session.orgId);
    const maxEngagements = PLAN_LIMITS[effectivePlan(sub)].maxEngagements;
    const engagementCount = await prisma.engagement.count({ where: { organizationId: session.orgId, archivedAt: null } });
    if (!underLimit(engagementCount, maxEngagements)) {
      return { error: `Your plan allows ${limitLabel(maxEngagements)} engagements. Upgrade in Settings → Billing to create more.` };
    }
  }

  const parsed = engagementSchema.safeParse(collect(fd));
  if (!parsed.success) return firstError(parsed.error);

  const created = await prisma.engagement.create({
    data: { organizationId: session.orgId, createdById: session.userId, ...toData(parsed.data) },
    select: { id: true, name: true },
  });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "engagement.created", detail: created.name });
  revalidatePath("/dashboard/engagements");
  redirect(`/dashboard/engagements/${created.id}`);
}

export async function updateEngagementAction(id: string, _prev: EngagementState, fd: FormData): Promise<EngagementState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const existing = await ownEngagement(id, session.orgId);
  if (!existing) return { error: "Engagement not found." };

  const parsed = engagementSchema.safeParse(collect(fd));
  if (!parsed.success) return firstError(parsed.error);

  // Status changes go through the lifecycle action; keep the existing status here.
  await prisma.engagement.update({ where: { id }, data: { ...toData(parsed.data), status: existing.status } });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "engagement.edited", detail: parsed.data.name });
  revalidatePath(`/dashboard/engagements/${id}`);
  redirect(`/dashboard/engagements/${id}`);
}

export async function setEngagementStatusAction(id: string, fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const existing = await ownEngagement(id, session.orgId);
  if (!existing) return;
  const next = String(fd.get("status") ?? "");
  if (next === existing.status || !canTransition(existing.status, next)) return;

  await prisma.engagement.update({ where: { id }, data: { status: next } });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "engagement.status_changed",
    detail: `${engagementStatusLabel(existing.status)} → ${engagementStatusLabel(next)}`,
  });
  revalidatePath(`/dashboard/engagements/${id}`);
  revalidatePath("/dashboard/engagements");
}

export async function setEngagementArchivedAction(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const id = String(fd.get("id") ?? "");
  const archive = String(fd.get("archive") ?? "") === "1";
  const existing = await ownEngagement(id, session.orgId);
  if (!existing) return;
  await prisma.engagement.update({ where: { id }, data: { archivedAt: archive ? new Date() : null } });
  await logActivity({
    organizationId: session.orgId, userId: session.userId,
    action: archive ? "engagement.archived" : "engagement.restored", detail: existing.name,
  });
  revalidatePath("/dashboard/engagements");
  revalidatePath(`/dashboard/engagements/${id}`);
}

export async function deleteEngagementAction(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return; // ADMIN+ only
  const id = String(fd.get("id") ?? "");
  const existing = await ownEngagement(id, session.orgId);
  if (!existing) return;
  // Assessments are detached (engagementId → null via SetNull), not deleted.
  await prisma.engagement.delete({ where: { id } });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "engagement.deleted", detail: existing.name });
  revalidatePath("/dashboard/engagements");
  redirect("/dashboard/engagements");
}
