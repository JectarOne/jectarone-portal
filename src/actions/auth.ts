"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { signupSchema, loginSchema, slugify } from "@/lib/validation";
import { loginThrottled, recordFailedLogin, clearLoginAttempts, ipThrottled, recordAttempt } from "@/lib/rate-limit";
import { issueToken } from "@/lib/token";
import { sendMail, verifyEmailTemplate, trialStartedTemplate, appUrl } from "@/lib/email";

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

  // Throttle per source IP so signup cannot be used to enumerate which emails
  // are registered at scale. (Full non-enumerable signup requires an email-
  // verification flow — see docs/PORTAL-SECURITY-FIXES.md.)
  if (await ipThrottled()) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await recordAttempt(email); // count probes toward the IP throttle
    return { error: "An account with that email already exists." };
  }

  // Unique slug for the organization.
  const base = slugify(organization);
  let slug = base;
  for (let i = 2; await prisma.organization.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const passwordHash = await hashPassword(password);
  const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);

  const membership = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    const org = await tx.organization.create({ data: { name: organization, slug } });
    // Every new organization starts on a 14-day full-featured (Professional
    // tier) trial — see src/lib/billing.ts for the same defaults used when a
    // subscription row is lazily provisioned for pre-existing organizations.
    await tx.subscription.create({
      data: { organizationId: org.id, plan: "professional", status: "trialing", trialEndsAt },
    });
    return tx.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
  });

  // Issue an email-verification token and send it. Failure to send must not
  // block account creation — the user can request a resend from /verify-email.
  try {
    const raw = await issueToken(membership.userId, "verify");
    const tpl = verifyEmailTemplate(`${appUrl()}/verify-email?token=${raw}`);
    await sendMail({ ...tpl, to: email });
  } catch { /* logged by the mailer; surfaced via the resend page */ }
  try {
    await sendMail({ ...trialStartedTemplate(organization, trialEndsAt), to: email });
  } catch { /* non-critical */ }

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

  // Brute-force / credential-stuffing throttle (per-email + per-IP). Applied
  // before any DB/bcrypt work and independent of whether the account exists,
  // so it does not leak account existence.
  if (await loginThrottled(email)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  // Constant-ish failure message to avoid leaking which emails exist.
  const invalid: ActionState = { error: "Incorrect email or password." };
  if (!user || user.memberships.length === 0) {
    await recordFailedLogin(email);
    return invalid;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordFailedLogin(email);
    return invalid;
  }

  await clearLoginAttempts(email);
  await setSessionCookie({ uid: user.id, oid: user.memberships[0].organizationId });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
