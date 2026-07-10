"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { hasRole, isRole } from "@/lib/rbac";
import { inviteSchema } from "@/lib/validation";
import { getOrCreateSubscription, effectivePlan } from "@/lib/billing";
import { PLAN_LIMITS, underLimit, limitLabel } from "@/lib/plans";
import { billingEnabled } from "@/lib/stripe";

export type TeamState = { error?: string; ok?: string };

/** Add a member to the current organization. ADMIN or OWNER only. */
export async function addMemberAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (!hasRole(session.role, "ADMIN")) return { error: "You do not have permission to add members." };

  if (billingEnabled()) {
    const sub = await getOrCreateSubscription(session.orgId);
    const maxUsers = PLAN_LIMITS[effectivePlan(sub)].maxUsers;
    const memberCount = await prisma.membership.count({ where: { organizationId: session.orgId } });
    if (!underLimit(memberCount, maxUsers)) {
      return { error: `Your plan allows ${limitLabel(maxUsers)} users. Upgrade in Settings → Billing to invite more.` };
    }
  }

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, email, role, password } = parsed.data;

  // Only OWNER can create another OWNER.
  if (role === "OWNER" && session.role !== "OWNER") {
    return { error: "Only an owner can grant the owner role." };
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: session.orgId } },
  });
  if (existing) return { error: "That person is already a member of this organization." };

  await prisma.membership.create({
    data: { userId: user.id, organizationId: session.orgId, role },
  });

  revalidatePath("/dashboard/team");
  return { ok: `Added ${email} as ${role}.` };
}

/** Change a member's role. OWNER only (roles are sensitive). */
export async function changeRoleAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "OWNER") return;

  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!membershipId || !isRole(role)) return;

  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.organizationId !== session.orgId) return;

  // Don't allow demoting the last owner.
  if (target.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.membership.count({
      where: { organizationId: session.orgId, role: "OWNER" },
    });
    if (owners <= 1) return;
  }

  await prisma.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath("/dashboard/team");
}

/** Remove a member. ADMIN or OWNER; cannot remove the last owner or yourself here. */
export async function removeMemberAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !hasRole(session.role, "ADMIN")) return;

  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return;

  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.organizationId !== session.orgId) return;
  if (target.userId === session.userId) return; // use "leave" for that, later

  if (target.role === "OWNER") {
    const owners = await prisma.membership.count({
      where: { organizationId: session.orgId, role: "OWNER" },
    });
    if (owners <= 1) return;
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  revalidatePath("/dashboard/team");
}
