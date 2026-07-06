"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

export type TokenState = { error?: string; created?: string };

/** Create an org API token. The raw value is returned ONCE (only its hash is stored). */
export async function createApiTokenAction(_prev: TokenState, fd: FormData): Promise<TokenState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "ADMIN")) return { error: "Only admins can create API tokens." };
  const name = String(fd.get("name") ?? "").trim().slice(0, 80) || "API token";

  const raw = `jo_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.apiToken.create({
    data: { organizationId: session.orgId, userId: session.userId, name, tokenHash, prefix: raw.slice(0, 7) },
  });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "apitoken.created", detail: name });
  revalidatePath("/dashboard/settings/api-tokens");
  return { created: raw };
}

export async function revokeApiTokenAction(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return;
  const id = String(fd.get("id") ?? "");
  const t = await prisma.apiToken.findUnique({ where: { id } });
  if (!t || t.organizationId !== session.orgId) return; // org-scoped
  await prisma.apiToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "apitoken.revoked", detail: t.name });
  revalidatePath("/dashboard/settings/api-tokens");
}
