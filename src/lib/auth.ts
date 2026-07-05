import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const COOKIE = "jo_session";
const ALG = "HS256";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env.");
  }
  return new TextEncoder().encode(s);
}

export type SessionToken = { uid: string; oid: string };

/** Create the signed session JWT (used by middleware-safe verify too). */
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
      return { uid: payload.uid, oid: payload.oid };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionToken): Promise<void> {
  const token = await signSession(payload);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function sessionCookieName(): string {
  return COOKIE;
}

/** Full session with DB-loaded user + active membership. Null if not authenticated. */
export async function getSession() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const token = await verifySession(raw);
  if (!token) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: token.uid, organizationId: token.oid } },
    include: { user: true, organization: true },
  });
  if (!membership) return null;

  return {
    userId: membership.userId,
    orgId: membership.organizationId,
    role: membership.role,
    user: { id: membership.user.id, name: membership.user.name, email: membership.user.email, emailVerifiedAt: membership.user.emailVerifiedAt },
    organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug },
  };
}

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
