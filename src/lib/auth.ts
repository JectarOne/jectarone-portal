import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const COOKIE = "jo_session";
const ALG = "HS256";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const SEEN_THROTTLE_MS = 5 * 60 * 1000;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env.");
  }
  return new TextEncoder().encode(s);
}

export type SessionToken = { uid: string; oid: string; sid?: string };

export async function signSession(payload: SessionToken): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (typeof payload.uid === "string" && typeof payload.oid === "string") {
      return { uid: payload.uid, oid: payload.oid, sid: typeof payload.sid === "string" ? payload.sid : undefined };
    }
    return null;
  } catch {
    return null;
  }
}

async function clientMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0].trim() : h.get("x-real-ip")) || "0.0.0.0";
  return { ip, userAgent: h.get("user-agent") || "Unknown device" };
}

/** Create a tracked session + set the signed cookie carrying its id (sid). */
export async function setSessionCookie(payload: SessionToken): Promise<void> {
  const { ip, userAgent } = await clientMeta();
  const session = await prisma.session.create({ data: { userId: payload.uid, ip, userAgent } });
  const token = await signSession({ uid: payload.uid, oid: payload.oid, sid: session.id });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Revoke the current session (if any) and clear the cookie. */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    const token = await verifySession(raw);
    if (token?.sid) {
      await prisma.session.updateMany({ where: { id: token.sid, revokedAt: null }, data: { revokedAt: new Date() } });
    }
  }
  jar.delete(COOKIE);
}

export function sessionCookieName(): string {
  return COOKIE;
}

/** Full session with DB-loaded user + active membership. Null if not authenticated
 * OR if the tracked session has been revoked. */
export async function getSession() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const token = await verifySession(raw);
  if (!token) return null;

  // Enforce session revocation (tokens issued after Sprint 13 carry sid).
  if (token.sid) {
    const sess = await prisma.session.findUnique({ where: { id: token.sid } });
    if (!sess || sess.revokedAt) return null;
    if (Date.now() - sess.lastSeenAt.getTime() > SEEN_THROTTLE_MS) {
      await prisma.session.update({ where: { id: sess.id }, data: { lastSeenAt: new Date() } });
    }
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: token.uid, organizationId: token.oid } },
    include: { user: true, organization: true },
  });
  if (!membership) return null;

  return {
    userId: membership.userId,
    orgId: membership.organizationId,
    role: membership.role,
    sessionId: token.sid ?? null,
    user: { id: membership.user.id, name: membership.user.name, email: membership.user.email, emailVerifiedAt: membership.user.emailVerifiedAt },
    organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug },
  };
}

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
