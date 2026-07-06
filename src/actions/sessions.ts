"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

/** Revoke one of the caller's own sessions (device sign-out). */
export async function revokeSessionAction(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(fd.get("id") ?? "");
  const target = await prisma.session.findUnique({ where: { id } });
  if (!target || target.userId !== session.userId) return; // only your own sessions
  await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "security.session_revoked",
    detail: id === session.sessionId ? "current session" : "another session",
  });
  revalidatePath("/dashboard/settings/sessions");
}

/** Sign out everywhere except the current session. */
export async function revokeOtherSessionsAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await prisma.session.updateMany({
    where: { userId: session.userId, revokedAt: null, NOT: { id: session.sessionId ?? "" } },
    data: { revokedAt: new Date() },
  });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "security.sessions_revoked_all", detail: "Signed out all other sessions" });
  revalidatePath("/dashboard/settings/sessions");
}
