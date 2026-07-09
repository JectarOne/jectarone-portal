import "server-only";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger";

// Transactional email. Uses authenticated SMTP when configured (the same
// mailbox the marketing site sends from). In development/test without SMTP it
// writes each message to a file outbox (.mail-outbox/) so flows can be tested
// without a real mail server. In production without SMTP it throws — password
// reset / email verification must have a working mailer.

const SMTP = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
  from: process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? "JectarOne <contact@jectar.one>",
};

export function mailConfigured(): boolean {
  return Boolean(SMTP.host && SMTP.user && SMTP.pass);
}

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

const OUTBOX = path.join(process.cwd(), ".mail-outbox");

export type Mail = { to: string; subject: string; text: string; html?: string };

let _transport: nodemailer.Transporter | null = null;
function transport(): nodemailer.Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: SMTP.host, port: SMTP.port, secure: SMTP.secure,
      auth: { user: SMTP.user, pass: SMTP.pass },
    });
  }
  return _transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (mailConfigured()) {
    try {
      await transport().sendMail({
        from: SMTP.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      // Structured log so Vercel Runtime Logs surface the Nodemailer code
      // (EAUTH, ECONNECTION, ETIMEDOUT, …) before rethrowing.
      logger.error("SMTP send failed", err, { to: mail.to, subject: mail.subject, host: SMTP.host });
      throw err;
    }
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email is not configured (SMTP_* env missing) — cannot send transactional email in production.");
  }
  // Dev/test fallback: write to a file outbox that tests can read.
  try { fs.mkdirSync(OUTBOX, { recursive: true }); } catch { /* ignore */ }
  const file = path.join(OUTBOX, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...mail, from: SMTP.from, at: new Date().toISOString() }, null, 2));
}

/* ---------- Templates ---------- */

export function verifyEmailTemplate(link: string): Mail {
  return {
    to: "", subject: "Verify your JectarOne email",
    text: `Welcome to JectarOne. Confirm your email to activate your account:\n\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`,
    html: `<p>Welcome to JectarOne. Confirm your email to activate your account:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
  };
}

export function resetPasswordTemplate(link: string): Mail {
  return {
    to: "", subject: "Reset your JectarOne password",
    text: `Someone requested a password reset for your JectarOne account. Set a new password:\n\n${link}\n\nThis link expires in 1 hour and can be used once. If you didn't request this, ignore this email — your password is unchanged.`,
    html: `<p>Someone requested a password reset for your JectarOne account. Set a new password:</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour and can be used once. If you didn't request this, ignore this email — your password is unchanged.</p>`,
  };
}

/* ---------- Sprint 19: billing lifecycle templates ---------- */

export function trialStartedTemplate(orgName: string, trialEndsAt: Date): Mail {
  const d = trialEndsAt.toISOString().slice(0, 10);
  return {
    to: "", subject: "Your JectarOne free trial has started",
    text: `Your 14-day trial for ${orgName} is active until ${d}. Explore engagements, findings, and AI-assisted reporting — upgrade any time from Settings → Billing.`,
    html: `<p>Your 14-day trial for <strong>${orgName}</strong> is active until ${d}.</p><p>Explore engagements, findings, and AI-assisted reporting — upgrade any time from Settings → Billing.</p>`,
  };
}

export function trialEndingTemplate(orgName: string, trialEndsAt: Date): Mail {
  const d = trialEndsAt.toISOString().slice(0, 10);
  return {
    to: "", subject: "Your JectarOne trial ends soon",
    text: `Your trial for ${orgName} ends on ${d}. Upgrade from Settings → Billing to keep access without interruption.`,
    html: `<p>Your trial for <strong>${orgName}</strong> ends on ${d}.</p><p>Upgrade from Settings → Billing to keep access without interruption.</p>`,
  };
}

export function paymentSucceededTemplate(orgName: string, amountCents: number, currency: string): Mail {
  const amt = (amountCents / 100).toFixed(2);
  return {
    to: "", subject: "Payment received — JectarOne",
    text: `We received your payment of ${amt} ${currency.toUpperCase()} for ${orgName}. Thank you for being a JectarOne customer.`,
    html: `<p>We received your payment of <strong>${amt} ${currency.toUpperCase()}</strong> for ${orgName}.</p><p>Thank you for being a JectarOne customer.</p>`,
  };
}

export function paymentFailedTemplate(orgName: string): Mail {
  return {
    to: "", subject: "Payment failed — action needed",
    text: `We couldn't process your latest payment for ${orgName}. Please update your payment method from Settings → Billing to avoid service interruption.`,
    html: `<p>We couldn't process your latest payment for <strong>${orgName}</strong>.</p><p>Please update your payment method from Settings → Billing to avoid service interruption.</p>`,
  };
}

export function subscriptionCancelledTemplate(orgName: string, endsAt: Date | null): Mail {
  const when = endsAt ? ` Your access continues until ${endsAt.toISOString().slice(0, 10)}.` : "";
  return {
    to: "", subject: "Subscription cancelled — JectarOne",
    text: `Your subscription for ${orgName} has been cancelled.${when} You can resume any time from Settings → Billing.`,
    html: `<p>Your subscription for <strong>${orgName}</strong> has been cancelled.${when}</p><p>You can resume any time from Settings → Billing.</p>`,
  };
}

export function planUpgradedTemplate(orgName: string, plan: string): Mail {
  return {
    to: "", subject: `Plan upgraded to ${plan} — JectarOne`,
    text: `${orgName} is now on the ${plan} plan. Thanks for growing with JectarOne.`,
    html: `<p><strong>${orgName}</strong> is now on the <strong>${plan}</strong> plan.</p><p>Thanks for growing with JectarOne.</p>`,
  };
}
