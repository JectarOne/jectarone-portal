"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { assetSchema } from "@/lib/validation";

export type AssetState = { error?: string; fieldErrors?: Record<string, string> };

function collect(formData: FormData) {
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    identifier: formData.get("identifier"),
    notes: formData.get("notes"),
  };
}

function firstError(err: ZodError): AssetState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: err.issues[0]?.message ?? "Invalid input.", fieldErrors };
}

async function assetInOrg(id: string, orgId: string) {
  const a = await prisma.asset.findUnique({ where: { id } });
  return a && a.organizationId === orgId ? a : null;
}

export async function createAssetAction(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };

  const parsed = assetSchema.safeParse(collect(formData));
  if (!parsed.success) return firstError(parsed.error);
  const d = parsed.data;

  await prisma.asset.create({
    data: {
      organizationId: session.orgId,
      createdById: session.userId,
      name: d.name,
      type: d.type,
      identifier: d.identifier ?? null,
      notes: d.notes ?? null,
    },
  });

  revalidatePath("/dashboard/assets");
  redirect("/dashboard/assets");
}

export async function updateAssetAction(id: string, _prev: AssetState, formData: FormData): Promise<AssetState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "MEMBER")) return { error: "You do not have permission." };
  const existing = await assetInOrg(id, session.orgId);
  if (!existing) return { error: "Asset not found." };

  const parsed = assetSchema.safeParse(collect(formData));
  if (!parsed.success) return firstError(parsed.error);
  const d = parsed.data;

  await prisma.asset.update({
    where: { id },
    data: { name: d.name, type: d.type, identifier: d.identifier ?? null, notes: d.notes ?? null },
  });

  revalidatePath("/dashboard/assets");
  return {};
}

export async function setAssetArchivedAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "MEMBER")) return;
  const id = String(formData.get("id") ?? "");
  const archive = String(formData.get("archive") ?? "") === "1";
  const existing = await assetInOrg(id, session.orgId);
  if (!existing) return;

  await prisma.asset.update({ where: { id }, data: { archivedAt: archive ? new Date() : null } });
  revalidatePath("/dashboard/assets");
}

export async function deleteAssetAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return; // ADMIN+ only
  const id = String(formData.get("id") ?? "");
  const existing = await assetInOrg(id, session.orgId);
  if (!existing) return;

  await prisma.asset.delete({ where: { id } }); // findings.assetId -> SetNull
  revalidatePath("/dashboard/assets");
}
