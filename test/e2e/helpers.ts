import { Page, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { AUTH_SECRET } from "./db-env";

export const PASSWORD = "Passw0rd!123";

export const USERS = {
  admin: "admin@northwind.test", // OWNER
  consultant: "consultant@northwind.test", // MEMBER / Security Analyst
  client: "client@northwind.test", // CLIENT read-only
  globexAdmin: "admin@globex.test", // other org
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
