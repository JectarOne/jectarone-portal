import { Page, expect } from "@playwright/test";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
import { AUTH_SECRET } from "./db-env";

const OUTBOX = path.join(process.cwd(), ".mail-outbox");

/** Poll the dev mail outbox for the newest email matching `needle` (and `to`). */
export async function waitForEmail(needle: string, opts: { to?: string; timeoutMs?: number } = {}): Promise<{ to: string; subject: string; text: string }> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(OUTBOX)) {
      const files = fs.readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
      for (const f of files.reverse()) {
        try {
          const m = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8"));
          if (typeof m.text === "string" && m.text.includes(needle) && (!opts.to || m.to === opts.to)) return m;
        } catch { /* ignore partial writes */ }
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email containing "${needle}"${opts.to ? ` to ${opts.to}` : ""} arrived within ${timeoutMs}ms`);
}

/** Sign up a brand-new user and verify their email — returns a clean, isolated account. */
export async function signupVerified(page: Page, email: string, password: string = PASSWORD) {
  await page.goto("/signup");
  await page.getByLabel(/your name/i).fill("Test User");
  await page.getByLabel(/organization/i).fill("Org " + email);
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /create organization/i }).click();
  await page.waitForURL(/\/verify-email/);
  const mail = await waitForEmail("/verify-email?token=", { to: email });
  await page.goto(`/verify-email?token=${tokenFromEmail(mail.text)}`);
  await expect(page.getByText(/your email is verified/i)).toBeVisible();
}

/** Extract a `token=...` value from an email body. */
export function tokenFromEmail(text: string): string {
  const m = text.match(/token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("no token in email");
  return m[1];
}

export const PASSWORD = "Passw0rd!123";

export const USERS = {
  admin: "admin@northwind.test", // OWNER
  consultant: "consultant@northwind.test", // MEMBER / Security Analyst
  client: "client@northwind.test", // CLIENT read-only
  globexAdmin: "admin@globex.test", // other org
  starterOwner: "owner@acme-starter.test", // OWNER, Starter plan, at its limits
};

/** Log in through the real UI and land on the dashboard. */
export async function login(page: Page, email: string, password: string = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard(\/|$)/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/);
}

/** Mint a session cookie directly (used to forge an EXPIRED token for the
 * session-expiry test). Mirrors src/lib/auth.ts: HS256, payload {uid,oid}. */
export async function makeSessionCookie(uid: string, oid: string, expSecondsFromNow: number) {
  const secret = new TextEncoder().encode(AUTH_SECRET);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ uid, oid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 10)
    .setExpirationTime(now + expSecondsFromNow)
    .sign(secret);
}

export async function expectOnLogin(page: Page) {
  await expect(page).toHaveURL(/\/login/);
}
