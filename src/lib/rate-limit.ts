import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";

// Login brute-force / credential-stuffing throttle. State lives in the DB so it
// works across serverless instances (an in-memory counter would not). Two
// sliding-window limits: per-targeted-email and per-source-IP.

export const LOGIN_MAX_PER_EMAIL = 5;
export const LOGIN_MAX_PER_IP = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Pure predicate — count of attempts in the window has reached the cap. */
export function isLockedOut(countInWindow: number, max: number): boolean {
  return countInWindow >= max;
}

/** Best-effort client IP from the proxy chain (Vercel sets x-forwarded-for). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "0.0.0.0";
  return h.get("x-real-ip") || "0.0.0.0";
}

/** True when the email OR the source IP has hit its failure cap in the window. */
export async function loginThrottled(email: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const ip = await getClientIp();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: email, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { ip, createdAt: { gt: since } } }),
  ]);
  return isLockedOut(byEmail, LOGIN_MAX_PER_EMAIL) || isLockedOut(byIp, LOGIN_MAX_PER_IP);
}

/** True when the source IP alone has hit the cap — used to slow signup-based
 * account enumeration (repeated "does this email exist?" probing). */
export async function ipThrottled(max: number = LOGIN_MAX_PER_IP): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const ip = await getClientIp();
  const n = await prisma.loginAttempt.count({ where: { ip, createdAt: { gt: since } } });
  return isLockedOut(n, max);
}

export async function recordAttempt(key: string): Promise<void> {
  const ip = await getClientIp();
  await prisma.loginAttempt.create({ data: { key, ip } });
}

export async function recordFailedLogin(email: string): Promise<void> {
  await recordAttempt(email);
}

/** Clear a user's failed-attempt rows after a successful authentication. */
export async function clearLoginAttempts(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: email } });
}
