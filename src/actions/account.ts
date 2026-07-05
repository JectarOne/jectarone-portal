"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { issueToken, consumeToken } from "@/lib/token";
import { sendMail, resetPasswordTemplate, verifyEmailTemplate, appUrl } from "@/lib/email";
import { ipThrottled, recordAttempt } from "@/lib/rate-limit";

export type MsgState = { error?: string; ok?: string };

const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z.string().min(8).max(200);

/** Verify an email address from its token (single-use). */
export async function verifyEmailAction(token: string): Promise<{ ok: boolean }> {
  const userId = await consumeToken(token, "verify");
  if (!userId) return { ok: false };
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return { ok: true };
}

/** Resend the verification email to the signed-in, still-unverified user. */
export async function resendVerificationAction(): Promise<MsgState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (session.user.emailVerifiedAt) return { ok: "Your email is already verified." };
  try {
    const raw = await issueToken(session.userId, "verify");
    const tpl = verifyEmailTemplate(`${appUrl()}/verify-email?token=${raw}`);
    await sendMail({ ...tpl, to: session.user.email });
  } catch {
    return { error: "Could not send the email right now. Please try again shortly." };
  }
  return { ok: "Verification email sent — check your inbox." };
}

/** Request a password reset. Non-enumerating: always returns the same message. */
export async function requestPasswordResetAction(_prev: MsgState, formData: FormData): Promise<MsgState> {
  const generic: MsgState = { ok: "If that email has an account, a reset link is on its way." };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return generic;
  if (await ipThrottled()) return generic; // throttle abuse / enumeration
  await recordAttempt(parsed.data);

  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (user) {
    try {
      const raw = await issueToken(user.id, "reset");
      const tpl = resetPasswordTemplate(`${appUrl()}/reset-password?token=${raw}`);
      await sendMail({ ...tpl, to: user.email });
    } catch { /* never reveal send failures */ }
  }
  return generic;
}

/** Complete a password reset with a valid token. */
export async function resetPasswordAction(_prev: MsgState, formData: FormData): Promise<MsgState> {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: "Password must be at least 8 characters." };

  const userId = await consumeToken(token, "reset");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };

  const passwordHash = await hashPassword(parsed.data);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Invalidate any other pending tokens for this user.
    prisma.token.deleteMany({ where: { userId, usedAt: null } }),
  ]);
  redirect("/login?reset=1");
}
