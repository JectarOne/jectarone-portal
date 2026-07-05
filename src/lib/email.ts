import "server-only";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

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
  from: process.env.EMAIL_FROM || "JectarOne <no-reply@jectar.one>",
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
    await transport().sendMail({ from: SMTP.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
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
