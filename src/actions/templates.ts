"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { findingTemplateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export type TemplateState = { error?: string; fieldErrors?: Record<string, string> };

function collect(fd: FormData) {
  const g = (k: string) => fd.get(k);
  return {
    title: g("title"), category: g("category"), severity: g("severity"),
    likelihood: g("likelihood"), impact: g("impact"),
    cvssScore: g("cvssScore"), cvssVector: g("cvssVector"), cwe: g("cwe"),
    owaspCategory: g("owaspCategory"), mitreTechnique: g("mitreTechnique"),
    description: g("description"), businessImpact: g("businessImpact"),
    remediation: g("remediation"), references: g("references"),
  };
}

function firstError(err: ZodError): TemplateState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: err.issues[0]?.message ?? "Invalid input.", fieldErrors };
}

function toData(d: import("@/lib/validation").FindingTemplateInput) {
  return {
    title: d.title, category: d.category, severity: d.severity,
    likelihood: d.likelihood, impact: d.impact,
    cvssScore: d.cvssScore ?? null, cvssVector: d.cvssVector ?? null, cwe: d.cwe ?? null,
    owaspCategory: d.owaspCategory ?? null, mitreTechnique: d.mitreTechnique ?? null,
    description: d.description ?? null, businessImpact: d.businessImpact ?? null,
    remediation: d.remediation ?? null, references: d.references ?? null,
  };
}

/** Org-scoped template the caller may modify (built-ins, organizationId=null, are read-only). */
async function ownTemplate(id: string, orgId: string) {
  const t = await prisma.findingTemplate.findUnique({ where: { id } });
  return t && t.organizationId === orgId ? t : null;
}

export async function createTemplateAction(_prev: TemplateState, fd: FormData): Promise<TemplateState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const parsed = findingTemplateSchema.safeParse(collect(fd));
  if (!parsed.success) return firstError(parsed.error);

  const created = await prisma.findingTemplate.create({
    data: { organizationId: session.orgId, createdById: session.userId, ...toData(parsed.data) },
    select: { id: true, title: true },
  });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "template.created", detail: created.title });
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates");
}

export async function updateTemplateAction(id: string, _prev: TemplateState, fd: FormData): Promise<TemplateState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const existing = await ownTemplate(id, session.orgId);
  if (!existing) return { error: "Template not found (built-in templates are read-only)." };

  const parsed = findingTemplateSchema.safeParse(collect(fd));
  if (!parsed.success) return firstError(parsed.error);

  await prisma.findingTemplate.update({ where: { id }, data: toData(parsed.data) });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "template.edited", detail: parsed.data.title });
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates");
}

export async function deleteTemplateAction(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return; // ADMIN+ only
  const id = String(fd.get("id") ?? "");
  const existing = await ownTemplate(id, session.orgId);
  if (!existing) return;
  await prisma.findingTemplate.delete({ where: { id } });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "template.deleted", detail: existing.title });
  revalidatePath("/dashboard/templates");
}
