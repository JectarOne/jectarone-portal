"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logActivity } from "@/lib/activity";

export type FormState = { error?: string; ok?: string };

const nameSchema = z.string().trim().min(2).max(120);

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  const parsed = nameSchema.safeParse(fd.get("name"));
  if (!parsed.success) return { error: "Enter a valid name (2+ characters)." };
  await prisma.user.update({ where: { id: session.userId }, data: { name: parsed.data } });
  revalidatePath("/dashboard/settings/profile");
  return { ok: "Profile updated." };
}

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "Current password is incorrect." };
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash: await hashPassword(next) } });
  // Sign out every OTHER session on password change.
  await prisma.session.updateMany({
    where: { userId: session.userId, revokedAt: null, NOT: { id: session.sessionId ?? "" } },
    data: { revokedAt: new Date() },
  });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "security.password_changed", detail: "Password changed — other sessions revoked" });
  return { ok: "Password changed. Other sessions were signed out." };
}

export async function updateOrgAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "ADMIN")) return { error: "Only admins can change organization settings." };
  const parsed = nameSchema.safeParse(fd.get("name"));
  if (!parsed.success) return { error: "Enter a valid organization name." };
  await prisma.organization.update({ where: { id: session.orgId }, data: { name: parsed.data } });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "org.renamed", detail: parsed.data });
  revalidatePath("/dashboard/settings/organization");
  return { ok: "Organization updated." };
}

export async function updateEmailPrefsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  const prefs = {
    findingAssigned: fd.get("findingAssigned") === "on",
    weeklySummary: fd.get("weeklySummary") === "on",
    productUpdates: fd.get("productUpdates") === "on",
  };
  await prisma.user.update({ where: { id: session.userId }, data: { emailPrefs: JSON.stringify(prefs) } });
  revalidatePath("/dashboard/settings/notifications");
  return { ok: "Email preferences saved." };
}
