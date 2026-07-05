import "server-only";
import crypto from "node:crypto";
import { prisma } from "./db";

// Single-use, hashed, expiring tokens for email verification and password reset.
// The raw token is sent by email; only its SHA-256 hash is persisted, so a DB
// read cannot recover a usable token.

export type TokenType = "verify" | "reset";
const TTL_MS: Record<TokenType, number> = {
  verify: 24 * 60 * 60 * 1000, // 24h
  reset: 60 * 60 * 1000, // 1h
};

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Create a token, invalidating any prior unused token of the same type. Returns the raw token. */
export async function issueToken(userId: string, type: TokenType): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL_MS[type]);
  await prisma.token.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.token.create({ data: { userId, type, tokenHash, expiresAt } });
  return raw;
}

/** Validate + consume a token (single-use). Returns the userId or null if invalid/expired/used. */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  if (!raw || typeof raw !== "string") return null;
  const t = await prisma.token.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt.getTime() < Date.now()) return null;
  await prisma.token.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t.userId;
}

/** Pure expiry check (unit-testable without a DB). */
export function isExpired(expiresAt: Date, now: number = Date.now()): boolean {
  return expiresAt.getTime() < now;
}
