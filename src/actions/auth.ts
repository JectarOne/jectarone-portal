"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { signupSchema, loginSchema, slugify } from "@/lib/validation";

export type ActionState = { error?: string };

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    organization: formData.get("organization"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, organization, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  // Unique slug for the organization.
  const base = slugify(organization);
  let slug = base;
  for (let i = 2; await prisma.organization.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const passwordHash = await hashPassword(password);

  const membership = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    const org = await tx.organization.create({ data: { name: organization, slug } });
    return tx.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
  });

  await setSessionCookie({ uid: membership.userId, oid: membership.organizationId });
  redirect("/dashboard");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  // Constant-ish failure message to avoid leaking which emails exist.
  const invalid: ActionState = { error: "Incorrect email or password." };
  if (!user || user.memberships.length === 0) return invalid;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid;

  await setSessionCookie({ uid: user.id, oid: user.memberships[0].organizationId });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
